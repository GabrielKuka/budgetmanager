from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone

from Accounts.models import Holding, Security, SecurityPrice
from Currency.models import ExchangeRate
from Currency.services import convert_amount, MissingExchangeRate
from Transactions.models import Transaction


def _to_decimal(value):
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _resolve_timeframe_dates(timeframe, today):
    """Return (start_date, end_date) for a given timeframe key."""
    if timeframe == "1D":
        start = today
    elif timeframe == "5D":
        start = today - timedelta(days=5)
    elif timeframe == "MTD":
        start = today.replace(day=1)
    elif timeframe == "YTD":
        start = today.replace(month=1, day=1)
    elif timeframe == "1Y":
        start = today - timedelta(days=365)
    elif timeframe == "5Y":
        start = today - timedelta(days=365 * 5)
    elif timeframe == "MAX":
        start = date(2000, 1, 1)
    else:
        raise ValueError(f"Unknown timeframe: {timeframe}")
    return start, today


def build_portfolio_timeseries(user, timeframe, target_currency, mode="value"):
    """
    Reconstruct portfolio holdings over time.

    mode="value":   Absolute market value (includes cash flow effect).
    mode="return":  Total return — price performance of each held share
                     relative to purchase price, isolating market moves
                     from cash flows.

    Returns list of {date, total, change_pct, return} dicts ordered by date.
    """
    today = timezone.localdate()
    start_date, end_date = _resolve_timeframe_dates(timeframe, today)

    # 1. Fetch all non-draft buy/sell transactions in date range + earlier
    #    (we need earlier trades to compute opening quantities)
    trades = (
        Transaction.objects.filter(
            user=user,
            transaction_type__in=("buy", "sell"),
            is_draft=False,
            date__lte=end_date,
        )
        .select_related("security_trade_detail__security")
        .order_by("date", "id")
    )

    if not trades:
        return []

    # 2. Group buy/sell by security → build running quantity timeline
    #    security_id -> [(date, delta_qty, price_per_unit)]
    #    For buys, price_per_unit is the purchase price (for cost basis tracking).
    #    For sells, price_per_unit is None (avg cost unchanged on sell).
    security_deltas = defaultdict(list)
    security_map = {}  # security_id -> Security obj
    all_trade_dates = set()

    for txn in trades:
        detail = getattr(txn, "security_trade_detail", None)
        if not detail:
            continue
        sec = detail.security
        qty = _to_decimal(detail.quantity)
        ppu = _to_decimal(detail.price_per_unit)
        if txn.transaction_type == "buy":
            security_deltas[sec.id].append((txn.date, qty, ppu))
        else:
            security_deltas[sec.id].append((txn.date, -qty, None))
        security_map[sec.id] = sec
        all_trade_dates.add(txn.date)

    # Also include holdings with current quantity > 0 that have prices
    # but no trades in range (long-held positions). Get their earliest
    # known date from a trade before range, or from the holding creation.
    current_holdings = Holding.objects.filter(
        account__user=user,
        quantity__gt=0,
    ).select_related("security")

    for h in current_holdings:
        if h.security_id not in security_map:
            security_map[h.security_id] = h.security
        if h.security_id not in security_deltas:
            # No trades at all — seed with a zero baseline the day before start
            security_deltas[h.security_id] = [
                (start_date - timedelta(days=1), Decimal("0"), None)
            ]

    # 3. Pre-load ALL prices for these securities (any date up to end_date)
    #    so we never fall back to per-date DB queries inside the loop.
    security_ids = list(security_map.keys())

    all_price_records = (
        SecurityPrice.objects.filter(
            security_id__in=security_ids,
            date__lte=end_date,
        )
        .order_by("security_id", "-date")
        .values("security_id", "date", "price")
    )

    # Group prices by security_id: {sec_id: {date: price}}
    prices_by_sec = defaultdict(dict)
    all_price_dates = set()
    for pr in all_price_records:
        prices_by_sec[pr["security_id"]][pr["date"]] = _to_decimal(pr["price"])
        if pr["date"] >= start_date:
            all_price_dates.add(pr["date"])

    # 4. Find the earliest meaningful date — first trade or first price
    first_trade_date = min(all_trade_dates) if all_trade_dates else end_date
    earliest_price_date = min(all_price_dates) if all_price_dates else end_date
    data_start = min(first_trade_date, earliest_price_date)

    # Clamp start_date so we don't include dates before any activity
    effective_start = max(start_date, data_start)

    # 5. Build timeline — use dates that have either trades or prices
    all_dates = sorted(all_trade_dates | all_price_dates)
    # Ensure effective_start is included
    if effective_start not in all_dates:
        all_dates.insert(0, effective_start)
    all_dates = [d for d in all_dates if effective_start <= d <= end_date]

    if not all_dates:
        return []

    # 6. Walk through dates, updating running quantities and computing values
    running_qty = defaultdict(Decimal)  # security_id -> current quantity
    running_cost_basis = defaultdict(Decimal)  # security_id -> total cost basis (qty * avg_cost)
    # Pre-sort deltas for fast replay
    sorted_deltas = {}
    for sec_id in security_deltas:
        sorted_deltas[sec_id] = sorted(
            security_deltas[sec_id], key=lambda x: x[0]
        )

    delta_pointers = {sec_id: 0 for sec_id in sorted_deltas}
    result = []
    first_total = None
    first_return_offset = None

    # ---- Batch-load exchange rates upfront ----
    all_currencies = set()
    for sec_id in security_ids:
        all_currencies.add(security_map[sec_id].currency.code)
    all_currencies.add(target_currency)

    # Single bulk query: get all needed rates at once
    all_rate_records = list(
        ExchangeRate.objects.filter(
            base_currency="USD",
            quote_currency__in=list(all_currencies),
            date__lte=end_date,
            provider=ExchangeRate.PROVIDER_FRANKFURTER,
        ).order_by("quote_currency", "-date").values("quote_currency", "date", "rate")
    )

    # Group by quote_currency: {cur: {date: rate}}
    rates_by_cur = defaultdict(dict)
    for r in all_rate_records:
        rates_by_cur[r["quote_currency"]][r["date"]] = _to_decimal(r["rate"])

    # Pre-compute rate for each (from_cur, date) needed
    fx_rate_batch = {}
    for d in all_dates:
        for cur in all_currencies:
            if cur == target_currency:
                continue
            cur_rate = _find_nearest_date_rate(rates_by_cur.get(cur, {}), d)
            tgt_rate = _find_nearest_date_rate(rates_by_cur.get(target_currency, {}), d)
            if cur_rate and tgt_rate:
                fx_rate_batch[(cur, d)] = tgt_rate / cur_rate

    def _get_rate(from_cur, target_date):
        cached = fx_rate_batch.get((from_cur, target_date))
        if cached is not None:
            return cached
        if from_cur == target_currency:
            return Decimal("1")
        return convert_amount(Decimal("1"), from_cur, target_currency, target_date)

    for current_date in all_dates:
        # Apply deltas for this date — track qty and cost basis
        for sec_id in security_deltas:
            deltas = sorted_deltas[sec_id]
            ptr = delta_pointers[sec_id]
            while ptr < len(deltas) and deltas[ptr][0] <= current_date:
                _txn_date, delta_qty, ppu = deltas[ptr]
                old_qty = running_qty[sec_id]
                old_cost = running_cost_basis[sec_id]
                if delta_qty > 0 and ppu is not None:
                    # Buy: increase cost basis
                    new_cost = old_cost + (delta_qty * ppu)
                    running_cost_basis[sec_id] = new_cost
                elif delta_qty < 0:
                    # Sell: reduce cost basis proportionally
                    if old_qty > 0:
                        removal_ratio = abs(delta_qty) / old_qty
                        running_cost_basis[sec_id] = old_cost * (Decimal("1") - removal_ratio)
                    else:
                        running_cost_basis[sec_id] = Decimal("0")
                running_qty[sec_id] += delta_qty
                delta_pointers[sec_id] = ptr + 1
                ptr += 1

        # Compute both value and return for this date
        daily_total = Decimal("0")
        daily_return = Decimal("0")
        any_priced = False

        for sec_id in security_ids:
            qty = running_qty.get(sec_id, Decimal("0"))
            if qty <= 0:
                continue

            # Find nearest price on or before current_date (no DB fallback — pre-loaded)
            sec = security_map[sec_id]
            sec_prices = prices_by_sec.get(sec_id, {})
            price = _find_nearest_price(sec_prices, current_date)

            if price is None:
                continue

            market_value = qty * price

            # Convert to target currency
            sec_currency_code = sec.currency.code
            try:
                rate = _get_rate(sec_currency_code, current_date)
                market_value_converted = market_value * rate
                daily_total += market_value_converted
                any_priced = True

                # Return = market_value - cost_basis (both converted)
                cost_basis = running_cost_basis.get(sec_id, Decimal("0"))
                if cost_basis > 0:
                    cost_basis_converted = cost_basis * rate
                    daily_return += market_value_converted - cost_basis_converted
            except MissingExchangeRate:
                continue

        if not any_priced or daily_total <= 0:
            continue

        # Normalize return so it starts at 0 on the first data point
        if first_return_offset is None:
            first_return_offset = daily_return

        if first_total is None:
            first_total = daily_total

        change_pct = (
            float((daily_total - first_total) / first_total * 100)
            if first_total and first_total > 0
            else 0.0
        )

        return_normalized = daily_return - first_return_offset
        total_out = return_normalized if mode == "return" else daily_total

        result.append(
            {
                "date": current_date.isoformat(),
                "total": float(total_out.quantize(Decimal("0.01"))),
                "change_pct": round(change_pct, 2),
                "return": float(return_normalized.quantize(Decimal("0.01"))),
            }
        )

    return result


def _find_nearest_date_rate(rate_dict, target_date):
    """Find nearest rate on or before target_date from {date: rate} dict."""
    if not rate_dict:
        return None
    best = None
    best_date = None
    for d, r in rate_dict.items():
        if d <= target_date:
            if best_date is None or d > best_date:
                best = r
                best_date = d
    return best


def _find_nearest_price(price_dict, target_date):
    """Find the price on or before target_date from a {date: price} dict."""
    if not price_dict:
        return None
    # Price dict dates are descending (from prefetch ordering)
    # Find the first date <= target_date
    best = None
    best_date = None
    for d, p in price_dict.items():
        if d <= target_date:
            if best_date is None or d > best_date:
                best = p
                best_date = d
    return best

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone

from Accounts.models import Holding, Security, SecurityPrice
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


def build_portfolio_timeseries(user, timeframe, target_currency):
    """
    Reconstruct portfolio holdings market value over time.

    Returns list of {date, total, change_pct} dicts ordered by date.
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
    #    security_id -> [(date, delta_qty)]
    security_deltas = defaultdict(list)
    security_map = {}  # security_id -> Security obj
    all_trade_dates = set()

    for txn in trades:
        detail = getattr(txn, "security_trade_detail", None)
        if not detail:
            continue
        sec = detail.security
        qty = _to_decimal(detail.quantity)
        delta = qty if txn.transaction_type == "buy" else -qty
        security_deltas[sec.id].append((txn.date, delta))
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
            security_deltas[h.security_id] = [(start_date - timedelta(days=1), Decimal("0"))]

    # 3. Collect all relevant dates — trade dates + price dates in range
    security_ids = list(security_map.keys())

    price_records = (
        SecurityPrice.objects.filter(
            security_id__in=security_ids,
            date__gte=start_date,
            date__lte=end_date,
        )
        .order_by("security_id", "-date")
        .values("security_id", "date", "price")
    )

    # Group prices by security_id: {sec_id: {date: price}}
    prices_by_sec = defaultdict(dict)
    all_price_dates = set()
    for pr in price_records:
        prices_by_sec[pr["security_id"]][pr["date"]] = _to_decimal(pr["price"])
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
    # Pre-sort deltas for fast replay
    sorted_deltas = {}
    for sec_id in security_deltas:
        sorted_deltas[sec_id] = sorted(security_deltas[sec_id], key=lambda x: x[0])

    delta_pointers = {sec_id: 0 for sec_id in sorted_deltas}
    result = []
    first_total = None
    conversion_rates = {}  # cache: (from_cur, to_cur, date) -> rate

    for current_date in all_dates:
        # Apply deltas for this date
        for sec_id in security_deltas:
            deltas = sorted_deltas[sec_id]
            ptr = delta_pointers[sec_id]
            while ptr < len(deltas) and deltas[ptr][0] <= current_date:
                running_qty[sec_id] += deltas[ptr][1]
                delta_pointers[sec_id] = ptr + 1
                ptr += 1

        # Compute total market value for this date
        daily_total = Decimal("0")
        any_priced = False

        for sec_id in security_ids:
            qty = running_qty.get(sec_id, Decimal("0"))
            if qty <= 0:
                continue

            # Find nearest price on or before current_date
            sec = security_map[sec_id]
            sec_prices = prices_by_sec.get(sec_id, {})
            price = _find_nearest_price(sec_prices, current_date)

            if price is None:
                # Try to find price in DB directly (might be outside prefetch range)
                price_obj = (
                    SecurityPrice.objects.filter(
                        security_id=sec_id, date__lte=current_date
                    )
                    .order_by("-date")
                    .values_list("price", flat=True)
                    .first()
                )
                if price_obj is None:
                    # No price yet for this security — skip it, don't skip the whole date
                    continue
                price = _to_decimal(price_obj)

            market_value = qty * price

            # Convert to target currency
            sec_currency_code = sec.currency.code
            try:
                cache_key = (sec_currency_code, target_currency, current_date)
                if cache_key not in conversion_rates:
                    rate = convert_amount(
                        Decimal("1"),
                        sec_currency_code,
                        target_currency,
                        current_date,
                    )
                    conversion_rates[cache_key] = rate
                else:
                    rate = conversion_rates[cache_key]
                daily_total += market_value * rate
                any_priced = True
            except MissingExchangeRate:
                # Cannot convert — skip this security for this date
                continue

        if not any_priced or daily_total <= 0:
            continue

        if first_total is None:
            first_total = daily_total

        change_pct = (
            float((daily_total - first_total) / first_total * 100)
            if first_total and first_total > 0
            else 0.0
        )

        result.append(
            {
                "date": current_date.isoformat(),
                "total": float(daily_total.quantize(Decimal("0.01"))),
                "change_pct": round(change_pct, 2),
            }
        )

    return result


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

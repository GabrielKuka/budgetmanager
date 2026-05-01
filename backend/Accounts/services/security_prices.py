from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import yfinance as yf
from django.conf import settings
from django.utils import timezone

from Accounts.models import SecurityPrice

SOURCE_YFINANCE_ADJ_CLOSE = "yfinance_adj_close"
PRICE_QUANT = Decimal("0.00000001")
LATEST_LOOKBACK_DAYS = 7
DEFAULT_YFINANCE_TIMEOUT = 30


@dataclass
class PriceSyncResult:
    fetched: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    failures: list = field(default_factory=list)

    def add(self, other):
        self.fetched += other.fetched
        self.created += other.created
        self.updated += other.updated
        self.skipped += other.skipped
        self.failed += other.failed
        self.failures.extend(other.failures)
        return self


def resolve_yahoo_symbol(security):
    symbol_map = getattr(settings, "SECURITY_PRICE_SYMBOL_MAP", {}) or {}
    return symbol_map.get(security.ticker.upper(), security.ticker).strip()


def sync_security_prices(
    securities,
    start_date=None,
    end_date=None,
    timeout=DEFAULT_YFINANCE_TIMEOUT,
    progress_callback=None,
):
    end_date = end_date or timezone.localdate()
    latest_only = start_date is None
    if latest_only:
        start_date = end_date - timedelta(days=LATEST_LOOKBACK_DAYS)

    result = PriceSyncResult()
    for security in securities:
        result.add(
            sync_security_price(
                security,
                start_date=start_date,
                end_date=end_date,
                latest_only=latest_only,
                timeout=timeout,
                progress_callback=progress_callback,
            )
        )
    return result


def sync_security_price(
    security,
    start_date,
    end_date,
    latest_only=False,
    timeout=DEFAULT_YFINANCE_TIMEOUT,
    progress_callback=None,
):
    result = PriceSyncResult()
    symbol = resolve_yahoo_symbol(security)
    if not symbol:
        result.skipped += 1
        result.failures.append(f"{security.ticker}: missing Yahoo symbol")
        return result

    try:
        if progress_callback:
            progress_callback("fetching", security, symbol, None)
        frame = fetch_adjusted_close_frame(
            symbol, start_date, end_date, timeout=timeout
        )
        rows = extract_adjusted_close_rows(frame)
    except Exception as exc:
        result.failed += 1
        result.failures.append(f"{security.ticker}: {exc}")
        if progress_callback:
            progress_callback("done", security, symbol, result)
        return result

    if latest_only and rows:
        rows = [max(rows, key=lambda row: row[0])]

    if not rows:
        result.skipped += 1
        result.failures.append(f"{security.ticker}: no adjusted close data")
        if progress_callback:
            progress_callback("done", security, symbol, result)
        return result

    for price_date, price in rows:
        result.fetched += 1
        row_result = upsert_security_price(security, price_date, price)
        result.created += row_result.created
        result.updated += row_result.updated
        result.skipped += row_result.skipped

    if progress_callback:
        progress_callback("done", security, symbol, result)
    return result


def fetch_adjusted_close_frame(
    symbol, start_date, end_date, timeout=DEFAULT_YFINANCE_TIMEOUT
):
    end_exclusive = end_date + timedelta(days=1)
    return yf.download(
        symbol,
        start=start_date.isoformat(),
        end=end_exclusive.isoformat(),
        interval="1d",
        auto_adjust=False,
        actions=False,
        progress=False,
        threads=False,
        timeout=timeout,
    )


def extract_adjusted_close_rows(frame):
    if frame is None or getattr(frame, "empty", True):
        return []

    series = _adjusted_close_series(frame)
    rows = []
    for index_value, raw_price in series.dropna().items():
        price = normalize_price(raw_price)
        if price is None:
            continue
        rows.append((_index_to_date(index_value), price))
    return rows


def normalize_price(value):
    try:
        price = Decimal(str(value)).quantize(
            PRICE_QUANT, rounding=ROUND_HALF_UP
        )
    except (InvalidOperation, TypeError, ValueError):
        return None
    if price <= 0:
        return None
    return price


def upsert_security_price(security, price_date, price):
    result = PriceSyncResult()
    _, created = SecurityPrice.objects.update_or_create(
        security=security,
        date=price_date,
        source=SOURCE_YFINANCE_ADJ_CLOSE,
        defaults={"price": price},
    )
    if created:
        result.created += 1
    else:
        result.updated += 1
    return result


def _adjusted_close_series(frame):
    if "Adj Close" in frame:
        return _first_series(frame["Adj Close"])

    for column in frame.columns:
        if isinstance(column, tuple) and "Adj Close" in column:
            return _first_series(frame[column])

    raise ValueError("yfinance response does not contain Adj Close")


def _first_series(value):
    if hasattr(value, "columns"):
        return value.iloc[:, 0]
    return value


def _index_to_date(index_value):
    if isinstance(index_value, datetime):
        return index_value.date()
    if isinstance(index_value, date):
        return index_value
    return index_value.date()

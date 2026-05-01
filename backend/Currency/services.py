from datetime import date as date_type
from decimal import Decimal

from django.utils.dateparse import parse_date

from .models import ExchangeRate

USD = "USD"
EUR = "EUR"
BGN = "BGN"
EUR_BGN_RATE = Decimal("1.95583")
SUPPORTED_CURRENCIES = ("USD", "EUR", "GBP", "BGN", "ALL", "CHF")


class MissingExchangeRate(ValueError):
    pass


def _normalize_currency(currency):
    return currency.upper()


def _normalize_date(value):
    if isinstance(value, date_type):
        return value
    parsed = parse_date(str(value))
    if parsed is None:
        raise ValueError(f"Invalid exchange rate date: {value}")
    return parsed


def _available_rate_date(target_date, quote_currency):
    quote_currency = _normalize_currency(quote_currency)
    if quote_currency == USD:
        return target_date

    return (
        ExchangeRate.objects.filter(
            date__lte=target_date,
            base_currency=USD,
            quote_currency=quote_currency,
            provider=ExchangeRate.PROVIDER_FRANKFURTER,
        )
        .order_by("-date")
        .values_list("date", flat=True)
        .first()
    )


def _usd_quote_rate(target_date, quote_currency):
    quote_currency = _normalize_currency(quote_currency)
    target_date = (
        get_latest_rate_date()
        if target_date is None
        else _normalize_date(target_date)
    )

    if quote_currency == USD:
        return Decimal("1")

    rate = (
        ExchangeRate.objects.filter(
            date__lte=target_date,
            base_currency=USD,
            quote_currency=quote_currency,
            provider=ExchangeRate.PROVIDER_FRANKFURTER,
        )
        .order_by("-date")
        .values_list("rate", flat=True)
        .first()
    )
    if rate is None:
        raise MissingExchangeRate(
            f"Missing USD/{quote_currency} rate on or before {target_date}"
        )
    return rate


def _latest_common_rate_date(from_currency, to_currency):
    latest_date = get_latest_rate_date()
    from_date = _available_rate_date(latest_date, from_currency)
    to_date = _available_rate_date(latest_date, to_currency)

    if from_date is None:
        raise MissingExchangeRate(
            f"Missing USD/{_normalize_currency(from_currency)} rate"
        )
    if to_date is None:
        raise MissingExchangeRate(
            f"Missing USD/{_normalize_currency(to_currency)} rate"
        )

    return min(from_date, to_date)


def get_latest_rate_date():
    latest_date = (
        ExchangeRate.objects.filter(
            base_currency=USD,
            provider=ExchangeRate.PROVIDER_FRANKFURTER,
        )
        .order_by("-date")
        .values_list("date", flat=True)
        .first()
    )
    if latest_date is None:
        raise MissingExchangeRate("No exchange rates have been synced.")
    return latest_date


def get_rate(target_date, from_currency, to_currency):
    from_currency = _normalize_currency(from_currency)
    to_currency = _normalize_currency(to_currency)

    if from_currency == to_currency:
        return Decimal("1")
    if from_currency == EUR and to_currency == BGN:
        return EUR_BGN_RATE
    if from_currency == BGN and to_currency == EUR:
        return Decimal("1") / EUR_BGN_RATE

    if target_date is None:
        target_date = _latest_common_rate_date(from_currency, to_currency)

    from_usd_rate = _usd_quote_rate(target_date, from_currency)
    to_usd_rate = _usd_quote_rate(target_date, to_currency)
    return to_usd_rate / from_usd_rate


def convert_amount(amount, from_currency, to_currency, target_date):
    amount = Decimal(str(amount))
    return amount * get_rate(target_date, from_currency, to_currency)

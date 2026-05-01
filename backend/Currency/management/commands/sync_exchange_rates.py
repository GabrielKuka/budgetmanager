from datetime import date
from decimal import Decimal

import requests
from django.db import transaction
from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_date

from Currency.models import ExchangeRate
from Currency.services import SUPPORTED_CURRENCIES, USD

FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates"


class Command(BaseCommand):
    help = "Sync USD-based exchange rates from Frankfurter."

    def add_arguments(self, parser):
        parser.add_argument("--from", dest="start_date")
        parser.add_argument("--to", dest="end_date")
        parser.add_argument("--date", dest="single_date")
        parser.add_argument("--base", default=USD)
        parser.add_argument(
            "--quotes",
            default=",".join(SUPPORTED_CURRENCIES),
            help="Comma-separated target currencies.",
        )
        parser.add_argument(
            "--batch-size",
            default=500,
            type=int,
            help="Rows to write per database batch.",
        )

    def handle(self, *args, **options):
        base = options["base"].upper()
        if base != USD:
            raise CommandError("Only USD base is supported for v1.")

        quotes = tuple(
            currency.strip().upper()
            for currency in options["quotes"].split(",")
            if currency.strip()
        )
        if not quotes:
            raise CommandError("At least one quote currency is required.")

        single_date = self._parse_optional_date(
            options["single_date"], "--date"
        )
        start_date = self._parse_optional_date(options["start_date"], "--from")
        end_date = self._parse_optional_date(options["end_date"], "--to")

        if single_date and (start_date or end_date):
            raise CommandError("--date cannot be combined with --from/--to.")
        if bool(start_date) != bool(end_date):
            raise CommandError("--from and --to must be provided together.")
        if start_date and start_date > end_date:
            raise CommandError("--from cannot be after --to.")
        batch_size = options["batch_size"]
        if batch_size <= 0:
            raise CommandError("--batch-size must be greater than zero.")

        self.stdout.write("Fetching rates from Frankfurter...")
        payload = self._fetch_rates(
            base, quotes, single_date, start_date, end_date
        )
        rows = self._extract_rows(payload, single_date)
        records = self._build_records(base, quotes, rows)

        self.stdout.write(
            f"Fetched {len(rows)} rate date(s), preparing {len(records)} row(s)."
        )
        synced = self._upsert_records(records, batch_size)
        self.stdout.write(
            self.style.SUCCESS(f"Synced {synced} exchange rates.")
        )

    def _build_records(self, base, quotes, rows):
        records = []
        for rate_date, rates in rows.items():
            currencies = set(quotes)
            if USD in currencies:
                rates[USD] = Decimal("1")

            for quote in sorted(currencies):
                if quote == base:
                    rate = Decimal("1")
                elif quote in rates:
                    rate = Decimal(str(rates[quote]))
                else:
                    continue

                records.append(
                    ExchangeRate(
                        date=rate_date,
                        base_currency=base,
                        quote_currency=quote,
                        provider=ExchangeRate.PROVIDER_FRANKFURTER,
                        rate=rate,
                    )
                )

        return records

    def _upsert_records(self, records, batch_size):
        if not records:
            return 0

        total = len(records)
        for start in range(0, total, batch_size):
            batch = records[start : start + batch_size]
            self._upsert_batch(batch)
            self.stdout.write(
                f"Wrote {min(start + len(batch), total)}/{total} rows..."
            )
        return total

    @transaction.atomic
    def _upsert_batch(self, batch):
        lookup = {
            (
                record.date,
                record.base_currency,
                record.quote_currency,
                record.provider,
            ): record
            for record in batch
        }
        existing = ExchangeRate.objects.filter(
            date__in={record.date for record in batch},
            base_currency__in={record.base_currency for record in batch},
            quote_currency__in={record.quote_currency for record in batch},
            provider__in={record.provider for record in batch},
        )
        existing_by_key = {
            (
                record.date,
                record.base_currency,
                record.quote_currency,
                record.provider,
            ): record
            for record in existing
        }

        to_create = []
        to_update = []
        for key, incoming in lookup.items():
            current = existing_by_key.get(key)
            if current is None:
                to_create.append(incoming)
            elif current.rate != incoming.rate:
                current.rate = incoming.rate
                to_update.append(current)

        if to_create:
            ExchangeRate.objects.bulk_create(
                to_create, batch_size=len(to_create)
            )
        if to_update:
            ExchangeRate.objects.bulk_update(
                to_update, ["rate"], batch_size=len(to_update)
            )

    def _fetch_rates(self, base, quotes, single_date, start_date, end_date):
        params = {
            "base": base,
            "quotes": ",".join(q for q in quotes if q != base),
        }
        if single_date:
            params["date"] = single_date.isoformat()
        elif start_date and end_date:
            params["from"] = start_date.isoformat()
            params["to"] = end_date.isoformat()

        response = requests.get(FRANKFURTER_URL, params=params, timeout=20)
        if response.status_code >= 400:
            raise CommandError(
                f"Frankfurter request failed ({response.status_code}): "
                f"{response.text}"
            )
        return response.json()

    def _extract_rows(self, payload, single_date):
        if isinstance(payload, list):
            rows = {}
            for item in payload:
                rate_date = self._parse_required_date(item.get("date"))
                quote = str(item.get("quote", "")).upper()
                rate = item.get("rate")
                if not quote or rate is None:
                    raise CommandError(f"Invalid Frankfurter rate row: {item}")
                rows.setdefault(rate_date, {})[quote] = rate
            return rows

        if not isinstance(payload, dict):
            raise CommandError("Unexpected Frankfurter response format.")

        rates = payload.get("rates")
        if not isinstance(rates, dict):
            raise CommandError("Frankfurter response does not contain rates.")

        if self._is_time_series_rates(rates):
            return {
                self._parse_required_date(rate_date): day_rates
                for rate_date, day_rates in rates.items()
            }

        rate_date = self._parse_required_date(
            payload.get("date") or single_date or date.today()
        )
        return {rate_date: rates}

    def _is_time_series_rates(self, rates):
        return bool(rates) and all(
            isinstance(value, dict) for value in rates.values()
        )

    def _parse_optional_date(self, value, option_name):
        if not value:
            return None
        parsed = parse_date(value)
        if parsed is None:
            raise CommandError(f"{option_name} must use YYYY-MM-DD format.")
        return parsed

    def _parse_required_date(self, value):
        parsed = parse_date(str(value))
        if parsed is None:
            raise CommandError(
                f"Invalid date in Frankfurter response: {value}"
            )
        return parsed

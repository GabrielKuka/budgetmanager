from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_date

from Accounts.models import Holding, Security
from Accounts.services.security_prices import (
    DEFAULT_YFINANCE_TIMEOUT,
    sync_security_prices,
)


class Command(BaseCommand):
    help = "Sync daily adjusted close security prices from yfinance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            action="append",
            default=[],
            help="Ticker to sync. Can be repeated or comma-separated.",
        )
        parser.add_argument("--from", dest="start_date")
        parser.add_argument("--to", dest="end_date")
        parser.add_argument(
            "--timeout",
            type=int,
            default=DEFAULT_YFINANCE_TIMEOUT,
            help="Per-yfinance-request timeout in seconds.",
        )

    def handle(self, *args, **options):
        start_date = self._parse_optional_date(options["start_date"], "--from")
        end_date = self._parse_optional_date(options["end_date"], "--to")
        timeout = options["timeout"]
        if end_date is None:
            end_date = timezone.localdate()
        if start_date and start_date > end_date:
            raise CommandError("--from cannot be after --to.")
        if timeout <= 0:
            raise CommandError("--timeout must be greater than zero.")

        securities = list(self._resolve_securities(options["ticker"]))
        if not securities:
            self.stdout.write("No securities to sync.")
            return

        mode = "backfill" if start_date else "latest"
        self.stdout.write(
            f"Syncing {len(securities)} security price(s) in {mode} mode."
        )
        result = sync_security_prices(
            securities,
            start_date=start_date,
            end_date=end_date,
            timeout=timeout,
            progress_callback=self._progress,
        )

        for failure in result.failures:
            self.stdout.write(self.style.WARNING(failure))

        message = (
            f"Security price sync complete: fetched={result.fetched}, "
            f"created={result.created}, updated={result.updated}, "
            f"skipped={result.skipped}, failed={result.failed}."
        )
        if result.failed:
            self.stdout.write(self.style.WARNING(message))
        else:
            self.stdout.write(self.style.SUCCESS(message))

    def _progress(self, stage, security, symbol, result):
        if stage == "fetching":
            self.stdout.write(f"Fetching {security.ticker} ({symbol})...")
            return

        message = (
            f"{security.ticker}: fetched={result.fetched}, "
            f"created={result.created}, updated={result.updated}, "
            f"skipped={result.skipped}, failed={result.failed}."
        )
        if result.failed:
            self.stdout.write(self.style.WARNING(message))
        else:
            self.stdout.write(message)

    def _resolve_securities(self, ticker_options):
        tickers = self._parse_tickers(ticker_options)
        if tickers:
            securities = list(
                Security.objects.filter(ticker__in=tickers).order_by("ticker")
            )
            found = {security.ticker for security in securities}
            missing = sorted(set(tickers) - found)
            if missing:
                raise CommandError(
                    f"Unknown security ticker(s): {', '.join(missing)}"
                )
            return securities

        security_ids = (
            Holding.objects.filter(quantity__gt=0)
            .values_list("security_id", flat=True)
            .distinct()
        )
        return Security.objects.filter(id__in=security_ids).order_by("ticker")

    def _parse_tickers(self, ticker_options):
        tickers = []
        for option in ticker_options:
            tickers.extend(
                ticker.strip().upper()
                for ticker in option.split(",")
                if ticker.strip()
            )
        return tickers

    def _parse_optional_date(self, value, option_name):
        if not value:
            return None
        parsed = parse_date(value)
        if parsed is None:
            raise CommandError(f"{option_name} must use YYYY-MM-DD format.")
        return parsed

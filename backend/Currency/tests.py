from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase

from Currency.models import ExchangeRate
from Currency.services import MissingExchangeRate, convert_amount, get_rate


class ExchangeRateModelTests(TestCase):
    def test_unique_exchange_rate_per_day_provider(self):
        payload = {
            "date": date(2026, 5, 1),
            "base_currency": "USD",
            "quote_currency": "EUR",
            "provider": ExchangeRate.PROVIDER_FRANKFURTER,
            "rate": Decimal("0.9200000000"),
        }
        ExchangeRate.objects.create(**payload)

        with self.assertRaises(IntegrityError), transaction.atomic():
            ExchangeRate.objects.create(**payload)


class ExchangeRateServiceTests(TestCase):
    def setUp(self):
        self.rate_date = date(2026, 5, 1)
        for quote, rate in {
            "USD": "1",
            "EUR": "0.92",
            "GBP": "0.80",
        }.items():
            ExchangeRate.objects.create(
                date=self.rate_date,
                base_currency="USD",
                quote_currency=quote,
                rate=Decimal(rate),
            )

    def test_get_rate_same_currency(self):
        self.assertEqual(get_rate(self.rate_date, "EUR", "EUR"), Decimal("1"))

    def test_convert_usd_to_eur(self):
        self.assertEqual(
            convert_amount("100", "USD", "EUR", self.rate_date),
            Decimal("92.00"),
        )

    def test_convert_eur_to_usd(self):
        self.assertEqual(
            convert_amount("92", "EUR", "USD", self.rate_date),
            Decimal("1") / Decimal("0.92") * Decimal("92"),
        )

    def test_convert_eur_to_gbp(self):
        self.assertEqual(
            convert_amount("100", "EUR", "GBP", self.rate_date),
            Decimal("100") / Decimal("0.92") * Decimal("0.80"),
        )

    def test_convert_eur_bgn_uses_fixed_peg(self):
        self.assertEqual(
            convert_amount("100", "EUR", "BGN", self.rate_date),
            Decimal("195.58300"),
        )
        self.assertEqual(
            convert_amount("195.583", "BGN", "EUR", self.rate_date),
            Decimal("100.0"),
        )

    def test_missing_rate_raises(self):
        with self.assertRaises(MissingExchangeRate):
            convert_amount("100", "EUR", "CHF", self.rate_date)

    def test_latest_conversion_uses_latest_common_rate_date(self):
        ExchangeRate.objects.create(
            date=date(2026, 5, 2),
            base_currency="USD",
            quote_currency="EUR",
            rate=Decimal("0.93"),
        )
        ExchangeRate.objects.create(
            date=date(2026, 5, 2),
            base_currency="USD",
            quote_currency="USD",
            rate=Decimal("1"),
        )

        self.assertEqual(
            convert_amount("100", "EUR", "GBP", None),
            Decimal("100") / Decimal("0.92") * Decimal("0.80"),
        )


class SyncExchangeRatesCommandTests(TestCase):
    @patch("Currency.management.commands.sync_exchange_rates.requests.get")
    def test_sync_range_is_idempotent_and_inserts_usd(self, mock_get):
        response = Mock(status_code=200)
        response.json.return_value = [
            {
                "date": "2026-05-01",
                "base": "USD",
                "quote": "EUR",
                "rate": 0.92,
            },
            {
                "date": "2026-05-01",
                "base": "USD",
                "quote": "GBP",
                "rate": 0.80,
            },
            {
                "date": "2026-05-02",
                "base": "USD",
                "quote": "EUR",
                "rate": 0.93,
            },
            {
                "date": "2026-05-02",
                "base": "USD",
                "quote": "GBP",
                "rate": 0.81,
            },
        ]
        mock_get.return_value = response

        call_command(
            "sync_exchange_rates",
            "--from",
            "2026-05-01",
            "--to",
            "2026-05-02",
            "--quotes",
            "USD,EUR,GBP",
        )
        call_command(
            "sync_exchange_rates",
            "--from",
            "2026-05-01",
            "--to",
            "2026-05-02",
            "--quotes",
            "USD,EUR,GBP",
        )

        self.assertEqual(ExchangeRate.objects.count(), 6)
        self.assertTrue(
            ExchangeRate.objects.filter(
                date=date(2026, 5, 1),
                base_currency="USD",
                quote_currency="USD",
                rate=Decimal("1"),
            ).exists()
        )

    @patch("Currency.management.commands.sync_exchange_rates.requests.get")
    def test_sync_single_date(self, mock_get):
        response = Mock(status_code=200)
        response.json.return_value = {
            "base": "USD",
            "date": "2026-05-01",
            "rates": {"EUR": 0.92},
        }
        mock_get.return_value = response

        call_command(
            "sync_exchange_rates",
            "--date",
            "2026-05-01",
            "--quotes",
            "USD,EUR",
        )

        self.assertEqual(ExchangeRate.objects.count(), 2)

    def test_rejects_partial_range(self):
        with self.assertRaises(CommandError):
            call_command("sync_exchange_rates", "--from", "2026-05-01")

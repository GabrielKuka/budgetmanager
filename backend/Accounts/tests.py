from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from time import sleep
from unittest.mock import patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from Accounts.models import (
    Account,
    CashBalance,
    Currency,
    Holding,
    Security,
    SecurityPrice,
)
from Accounts.services.security_prices import (
    SOURCE_YFINANCE_ADJ_CLOSE,
    sync_security_prices,
)


def price_frame(rows):
    return pd.DataFrame(
        {"Adj Close": [price for _, price in rows]},
        index=pd.to_datetime([price_date for price_date, _ in rows]),
    )


class SecurityPriceModelTests(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "US Dollar", "symbol": "$"},
        )
        self.security = Security.objects.create(
            name="SPDR S&P 500 ETF",
            ticker="SPY",
            currency=self.currency,
        )

    def test_unique_security_price_per_day_source(self):
        payload = {
            "security": self.security,
            "date": date(2026, 5, 1),
            "source": SOURCE_YFINANCE_ADJ_CLOSE,
            "price": Decimal("500.00000000"),
        }
        SecurityPrice.objects.create(**payload)

        with self.assertRaises(IntegrityError), transaction.atomic():
            SecurityPrice.objects.create(**payload)

    def test_updated_on_changes_when_price_is_refreshed(self):
        price = SecurityPrice.objects.create(
            security=self.security,
            date=date(2026, 5, 1),
            source=SOURCE_YFINANCE_ADJ_CLOSE,
            price=Decimal("500.00000000"),
        )
        original_updated_on = price.updated_on

        sleep(0.01)
        price.price = Decimal("501.00000000")
        price.save(update_fields=["price", "updated_on"])
        price.refresh_from_db()

        self.assertGreater(price.updated_on, original_updated_on)


class SecurityPriceSyncServiceTests(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "US Dollar", "symbol": "$"},
        )
        self.security = Security.objects.create(
            name="SPDR S&P 500 ETF",
            ticker="SPY",
            currency=self.currency,
        )

    @patch("Accounts.services.security_prices.yf.download")
    def test_sync_creates_rows_from_adjusted_close(self, mock_download):
        mock_download.return_value = price_frame(
            [
                ("2026-04-30", "500.123456789"),
                ("2026-05-01", "501.25"),
            ]
        )

        result = sync_security_prices(
            [self.security],
            start_date=date(2026, 4, 30),
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(result.fetched, 2)
        self.assertEqual(result.created, 2)
        self.assertEqual(result.updated, 0)
        prices = list(SecurityPrice.objects.order_by("date"))
        self.assertEqual(prices[0].price, Decimal("500.12345679"))
        self.assertEqual(prices[1].price, Decimal("501.25000000"))
        self.assertTrue(
            all(price.source == SOURCE_YFINANCE_ADJ_CLOSE for price in prices)
        )

    @patch("Accounts.services.security_prices.yf.download")
    def test_sync_updates_existing_same_day_row(self, mock_download):
        SecurityPrice.objects.create(
            security=self.security,
            date=date(2026, 5, 1),
            source=SOURCE_YFINANCE_ADJ_CLOSE,
            price=Decimal("500.00000000"),
        )
        mock_download.return_value = price_frame([("2026-05-01", "501")])

        result = sync_security_prices(
            [self.security],
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(result.created, 0)
        self.assertEqual(result.updated, 1)
        self.assertEqual(SecurityPrice.objects.count(), 1)
        self.assertEqual(
            SecurityPrice.objects.get().price, Decimal("501.00000000")
        )

    @patch("Accounts.services.security_prices.yf.download")
    def test_sync_skips_null_and_zero_adjusted_close(self, mock_download):
        mock_download.return_value = price_frame(
            [
                ("2026-04-29", None),
                ("2026-04-30", "0"),
                ("2026-05-01", "501"),
            ]
        )

        result = sync_security_prices(
            [self.security],
            start_date=date(2026, 4, 29),
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(result.fetched, 1)
        self.assertEqual(result.created, 1)
        self.assertEqual(SecurityPrice.objects.count(), 1)

    @override_settings(SECURITY_PRICE_SYMBOL_MAP={"SPY": "SPY.MX"})
    @patch("Accounts.services.security_prices.yf.download")
    def test_sync_uses_symbol_map_before_ticker(self, mock_download):
        mock_download.return_value = price_frame([("2026-05-01", "501")])

        sync_security_prices(
            [self.security],
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(mock_download.call_args.kwargs["start"], "2026-05-01")
        self.assertEqual(mock_download.call_args.args[0], "SPY.MX")

    @patch("Accounts.services.security_prices.yf.download")
    def test_sync_empty_response_is_skipped_not_crashing(self, mock_download):
        mock_download.return_value = pd.DataFrame()

        result = sync_security_prices(
            [self.security],
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(result.skipped, 1)
        self.assertEqual(result.failed, 0)
        self.assertEqual(SecurityPrice.objects.count(), 0)

    @patch("Accounts.services.security_prices.yf.download")
    def test_latest_mode_uses_only_latest_available_row(self, mock_download):
        mock_download.return_value = price_frame(
            [
                ("2026-04-30", "500"),
                ("2026-05-01", "501"),
            ]
        )

        result = sync_security_prices(
            [self.security],
            end_date=date(2026, 5, 1),
        )

        self.assertEqual(result.created, 1)
        self.assertEqual(SecurityPrice.objects.get().date, date(2026, 5, 1))


class SyncSecurityPricesCommandTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            name="User",
            email="user@example.com",
            phone="+111111111",
            password="password",
        )
        self.currency, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "US Dollar", "symbol": "$"},
        )
        self.account = Account.objects.create(
            user=self.user,
            type=1,
            name="Brokerage",
            currency="USD",
        )
        self.spy = Security.objects.create(
            name="SPDR S&P 500 ETF",
            ticker="SPY",
            currency=self.currency,
        )
        self.msft = Security.objects.create(
            name="Microsoft",
            ticker="MSFT",
            currency=self.currency,
        )
        Holding.objects.create(
            account=self.account,
            security=self.spy,
            quantity=Decimal("2"),
            average_cost=Decimal("400"),
        )
        Holding.objects.create(
            account=self.account,
            security=self.msft,
            quantity=Decimal("0"),
            average_cost=Decimal("300"),
        )

    @patch("Accounts.services.security_prices.yf.download")
    def test_default_command_syncs_only_active_holding_securities(
        self, mock_download
    ):
        mock_download.return_value = price_frame([("2026-05-01", "501")])
        out = StringIO()

        call_command("sync_security_prices", stdout=out)

        self.assertEqual(mock_download.call_count, 1)
        self.assertEqual(mock_download.call_args.args[0], "SPY")
        self.assertIn("created=1", out.getvalue())

    @patch("Accounts.services.security_prices.yf.download")
    def test_ticker_option_limits_sync_scope(self, mock_download):
        mock_download.return_value = price_frame([("2026-05-01", "300")])

        call_command("sync_security_prices", "--ticker", "MSFT")

        self.assertEqual(mock_download.call_count, 1)
        self.assertEqual(mock_download.call_args.args[0], "MSFT")
        self.assertEqual(
            SecurityPrice.objects.get().security_id,
            self.msft.id,
        )

    @patch("Accounts.services.security_prices.yf.download")
    def test_backfill_from_creates_multiple_daily_rows(self, mock_download):
        mock_download.return_value = price_frame(
            [
                ("2026-04-30", "500"),
                ("2026-05-01", "501"),
            ]
        )

        call_command(
            "sync_security_prices",
            "--from",
            "2026-04-30",
            "--to",
            "2026-05-01",
        )

        self.assertEqual(SecurityPrice.objects.count(), 2)
        self.assertEqual(mock_download.call_args.kwargs["start"], "2026-04-30")
        self.assertEqual(mock_download.call_args.kwargs["end"], "2026-05-02")

    def test_invalid_date_arguments_raise_command_error(self):
        with self.assertRaises(CommandError):
            call_command("sync_security_prices", "--from", "2026/05/01")

        with self.assertRaises(CommandError):
            call_command(
                "sync_security_prices",
                "--from",
                "2026-05-02",
                "--to",
                "2026-05-01",
            )

        with self.assertRaises(CommandError):
            call_command("sync_security_prices", "--timeout", "0")

    @patch("Accounts.services.security_prices.yf.download")
    def test_command_summary_counts_skipped_and_failed(self, mock_download):
        mock_download.side_effect = [
            pd.DataFrame(),
            RuntimeError("provider failed"),
        ]
        Holding.objects.filter(security=self.msft).update(
            quantity=Decimal("1")
        )
        out = StringIO()

        call_command("sync_security_prices", stdout=out)

        output = out.getvalue()
        self.assertIn("skipped=1", output)
        self.assertIn("failed=1", output)

    @patch("Accounts.services.security_prices.yf.download")
    def test_command_passes_timeout_and_prints_progress(self, mock_download):
        mock_download.return_value = price_frame([("2026-05-01", "501")])
        out = StringIO()

        call_command("sync_security_prices", "--timeout", "5", stdout=out)

        self.assertEqual(mock_download.call_args.kwargs["timeout"], 5)
        output = out.getvalue()
        self.assertIn("Fetching SPY (SPY)", output)
        self.assertIn("SPY: fetched=1", output)


class SecurityPriceIntegrationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            name="User",
            email="user@example.com",
            phone="+111111111",
            password="password",
        )
        self.client = APIClient()
        self.token = Token.objects.create(user=self.user)
        self.currency, _ = Currency.objects.get_or_create(
            code="EUR",
            defaults={"name": "Euro", "symbol": "EUR"},
        )
        self.account = Account.objects.create(
            user=self.user,
            type=1,
            name="Brokerage",
            currency="EUR",
        )
        CashBalance.objects.create(
            account=self.account,
            currency=self.currency,
            balance=Decimal("100"),
        )
        self.security = Security.objects.create(
            name="Test ETF",
            ticker="TETF",
            currency=self.currency,
        )
        Holding.objects.create(
            account=self.account,
            security=self.security,
            quantity=Decimal("2"),
            average_cost=Decimal("100"),
        )
        SecurityPrice.objects.create(
            security=self.security,
            date=timezone.localdate() - timedelta(days=1),
            source=SOURCE_YFINANCE_ADJ_CLOSE,
            price=Decimal("125.00000000"),
        )

    def test_account_response_includes_latest_price_and_market_value(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        response = self.client.get("/accounts/")

        self.assertEqual(response.status_code, 200)
        holding = response.data[0]["holdings"][0]
        self.assertEqual(holding["latest_price"]["price"], "125.00000000")
        self.assertEqual(
            holding["market_value"], Decimal("250.0000000000000000")
        )

    def test_account_totals_reflect_synced_security_price(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        response = self.client.get("/accounts/totals", {"currency": "EUR"})

        self.assertEqual(response.status_code, 200)
        account_total = response.data["accounts"][str(self.account.id)]
        self.assertEqual(account_total["holdings_total"], 250.0)
        self.assertEqual(response.data["summary"]["total_assets"], 350.0)

    def test_account_totals_include_cash_and_asset_class_breakdowns(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        hard_cash = Account.objects.create(
            user=self.user,
            type=2,
            name="Wallet",
            currency="EUR",
        )
        CashBalance.objects.create(
            account=hard_cash,
            currency=self.currency,
            balance=Decimal("40"),
        )

        response = self.client.get("/accounts/totals", {"currency": "EUR"})

        self.assertEqual(response.status_code, 200)
        summary = response.data["summary"]
        self.assertEqual(summary["cash_breakdown"]["cash_balances"], 100.0)
        self.assertEqual(summary["cash_breakdown"]["hard_cash"], 40.0)
        self.assertEqual(
            summary["investments_by_asset_class"],
            [
                {
                    "asset_class": "equity",
                    "label": "Equity",
                    "amount": 250.0,
                }
            ],
        )

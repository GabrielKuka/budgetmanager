from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from Accounts.models import (
    Account,
    CashBalance,
    Currency,
    Holding,
    Security,
    SecurityPrice,
)
from Transactions.models import TradeDetail, Transaction
from Users.models import User

from .models import TangibleAsset, Unit


class PreciousMetalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            name="Metal Owner",
            email="metal@example.com",
            phone="+15550000001",
            password="password",
        )
        self.currency, _ = Currency.objects.get_or_create(
            code="EUR",
            defaults={"name": "Euro", "symbol": "€", "currency_type": "fiat"},
        )
        self.gram = Unit.objects.get(code="gram")
        self.troy_ounce = Unit.objects.get(code="troy_ounce")
        self.piece = Unit.objects.get(code="piece")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _asset(self, **overrides):
        values = {
            "user": self.user,
            "name": "Gold bar",
            "asset_type": "precious_metal",
            "acquired_on": date(2026, 8, 20),
            "acquisition_cost": Decimal("5000"),
            "currency": self.currency,
            "quantity": Decimal("100"),
            "unit": self.gram,
            "metal_type": "gold",
        }
        values.update(overrides)
        return TangibleAsset(**values)

    def test_standard_metal_types_validate(self):
        for metal in ("gold", "silver", "platinum", "palladium"):
            self._asset(metal_type=metal).full_clean()

    def test_other_metal_requires_custom_name(self):
        with self.assertRaises(ValidationError):
            self._asset(metal_type="other").full_clean()
        self._asset(metal_type="other", metal_name="Rhodium").full_clean()

    def test_precious_metal_requires_type_and_mass_unit(self):
        with self.assertRaises(ValidationError):
            self._asset(metal_type=None).full_clean()
        with self.assertRaises(ValidationError):
            self._asset(unit=self.piece).full_clean()

    def test_non_metal_rejects_metal_fields(self):
        with self.assertRaises(ValidationError):
            self._asset(
                asset_type="other", metal_type="gold", unit=None, quantity=1
            ).full_clean()

    def test_import_persists_silver_and_troy_ounce(self):
        response = self.client.post(
            "/tangible-assets/",
            {
                "name": "Silver coins",
                "asset_type": "precious_metal",
                "metal_type": "silver",
                "quantity": "10",
                "unit_id": self.troy_ounce.id,
                "acquired_on": "2026-08-20",
                "acquisition_cost": "350",
                "currency_id": self.currency.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["metal_type"], "silver")
        self.assertEqual(response.data["unit"]["code"], "troy_ounce")

    def test_purchase_creates_normal_buy_for_gold(self):
        account = Account.objects.create(user=self.user, type=0, name="Bank")
        balance = CashBalance.objects.create(
            account=account, currency=self.currency, balance=Decimal("10000")
        )
        response = self.client.post(
            "/tangible-assets/purchase",
            {
                "name": "Gold bar",
                "asset_type": "precious_metal",
                "metal_type": "gold",
                "quantity": "100",
                "unit_id": self.gram.id,
                "date": "2026-08-20",
                "amount": "5000",
                "from_cash_balance": balance.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        asset = TangibleAsset.objects.get(pk=response.data["id"])
        self.assertEqual(asset.metal_type, "gold")
        self.assertEqual(asset.unit_id, self.gram.id)
        self.assertEqual(
            Transaction.objects.get(
                pk=response.data["transaction_id"]
            ).transaction_type,
            "buy",
        )
        self.assertTrue(
            TradeDetail.objects.filter(tangible_asset=asset).exists()
        )
        balance.refresh_from_db()
        self.assertEqual(balance.balance, Decimal("5000"))


class UnifiedPortfolioReadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            name="Portfolio Owner",
            email="portfolio@example.com",
            phone="+15550000002",
            password="password",
        )
        self.currency, _ = Currency.objects.get_or_create(
            code="EUR",
            defaults={"name": "Euro", "symbol": "€", "currency_type": "fiat"},
        )
        self.account = Account.objects.create(
            user=self.user, type=1, name="Broker"
        )
        self.balance = CashBalance.objects.create(
            account=self.account,
            currency=self.currency,
            balance=Decimal("500"),
        )
        self.security = Security.objects.create(
            name="Example Equity",
            ticker="EXMP",
            currency=self.currency,
        )
        self.holding = Holding.objects.create(
            account=self.account,
            security=self.security,
            quantity=Decimal("2"),
            average_cost=Decimal("100"),
        )
        SecurityPrice.objects.create(
            security=self.security,
            date=date(2026, 8, 20),
            price=Decimal("150"),
        )
        self.tangible = TangibleAsset.objects.create(
            user=self.user,
            name="Apartment",
            asset_type="real_estate",
            acquired_on=date(2026, 8, 20),
            acquisition_cost=Decimal("1000"),
            currency=self.currency,
            property_type="residential",
        )
        self.security_trade = Transaction.objects.create(
            user=self.user,
            transaction_type="buy",
            date=date(2026, 8, 20),
            amount=Decimal("200"),
            from_account=self.account,
        )
        TradeDetail.objects.create(
            transaction=self.security_trade,
            security=self.security,
            holding=self.holding,
            cash_balance=self.balance,
            quantity=Decimal("2"),
            price_per_unit=Decimal("100"),
        )
        self.tangible_trade = Transaction.objects.create(
            user=self.user,
            transaction_type="buy",
            date=date(2026, 8, 20),
            amount=Decimal("1000"),
            from_account=self.account,
        )
        TradeDetail.objects.create(
            transaction=self.tangible_trade,
            tangible_asset=self.tangible,
            cash_balance=self.balance,
            quantity=Decimal("1"),
            price_per_unit=Decimal("1000"),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_portfolio_combines_current_security_and_tangible_values(self):
        response = self.client.get("/assets/portfolio?currency=EUR")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["summary"],
            {
                "investments": 300.0,
                "tangible_assets": 1000.0,
                "total": 1300.0,
            },
        )
        self.assertEqual(len(response.data["security_positions"]), 1)
        self.assertEqual(
            response.data["security_positions"][0]["ticker"], "EXMP"
        )
        self.assertEqual(
            response.data["security_positions"][0]["structure"], "stock"
        )
        self.assertEqual(
            response.data["security_positions"][0]["unrealized_pnl"], 100.0
        )
        self.assertEqual(len(response.data["tangible_assets"]), 1)

    def test_activity_contains_both_asset_kinds(self):
        response = self.client.get("/assets/activity")

        self.assertEqual(response.status_code, 200, response.data)
        kinds = {item["asset_kind"] for item in response.data["results"]}
        self.assertEqual(kinds, {"security", "tangible"})

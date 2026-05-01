from decimal import Decimal
from datetime import date

from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from Accounts.models import Account, CashBalance, Currency, Security
from Currency.models import ExchangeRate
from Transactions.models import Holding, Transaction, TransactionCategory
from Users.models import User
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase


class TransactionsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            name="User One",
            email="user1@example.com",
            phone="+111111111",
            password="pass1234",
        )
        self.other_user = User.objects.create_user(
            name="User Two",
            email="user2@example.com",
            phone="+222222222",
            password="pass1234",
        )
        self.token = Token.objects.create(user=self.user)
        self.other_token = Token.objects.create(user=self.other_user)

        self.eur, _ = Currency.objects.get_or_create(
            code="EUR",
            defaults={"name": "Euro", "symbol": "EUR"},
        )
        self.usd, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "US Dollar", "symbol": "USD"},
        )
        for quote in ("USD", "EUR"):
            ExchangeRate.objects.update_or_create(
                date=date(2026, 5, 1),
                base_currency="USD",
                quote_currency=quote,
                provider=ExchangeRate.PROVIDER_FRANKFURTER,
                defaults={"rate": Decimal("1")},
            )

        self.account_eur = Account.objects.create(
            user=self.user,
            type=0,
            name="Main EUR",
            amount=1000,
            currency="EUR",
        )
        self.account_usd = Account.objects.create(
            user=self.user,
            type=1,
            name="Broker USD",
            amount=500,
            currency="USD",
        )
        self.other_account = Account.objects.create(
            user=self.other_user,
            type=0,
            name="Other EUR",
            amount=300,
            currency="EUR",
        )

        self.balance_eur = CashBalance.objects.create(
            account=self.account_eur,
            currency=self.eur,
            balance=Decimal("1000"),
        )
        self.balance_usd = CashBalance.objects.create(
            account=self.account_usd,
            currency=self.usd,
            balance=Decimal("500"),
        )
        self.other_balance = CashBalance.objects.create(
            account=self.other_account,
            currency=self.eur,
            balance=Decimal("300"),
        )

        self.income_category = TransactionCategory.objects.create(
            category="Salary",
            category_type=0,
        )
        self.expense_category = TransactionCategory.objects.create(
            category="Food",
            category_type=1,
        )

    def _auth_header(self, raw=False):
        if raw:
            return self.token.key
        return f"Token {self.token.key}"

    def test_auth_supports_both_token_header_formats(self):
        url = "/transactions/get_expenses"

        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=self._auth_header(raw=True))
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_create_income_legacy_payload_and_read_contract(self):
        self.client.credentials(HTTP_AUTHORIZATION=self._auth_header(raw=True))
        add_response = self.client.post(
            "/transactions/add",
            {
                "type": 0,
                "date": "2026-04-01",
                "amount": "123.45",
                "to_account": self.account_eur.id,
                "category": self.income_category.id,
                "tags": [{"name": "salary"}],
            },
            format="json",
        )
        self.assertEqual(add_response.status_code, 201)

        self.balance_eur.refresh_from_db()
        self.assertEqual(self.balance_eur.balance, Decimal("1123.45"))

        list_response = self.client.get("/transactions/get_incomes")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

        row = list_response.data[0]
        for key in (
            "id",
            "transaction_type",
            "date",
            "description",
            "created_on",
            "tags",
            "amount",
            "category",
            "from_account",
            "to_account",
            "account",
            "from_cash_balance",
            "to_cash_balance",
        ):
            self.assertIn(key, row)

    def test_transfer_updates_balances_and_derives_fx_rate(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )
        response = self.client.post(
            "/transactions/add",
            {
                "type": 2,
                "date": "2026-04-02",
                "from_account": self.account_eur.id,
                "to_account": self.account_usd.id,
                "from_amount": "20",
                "to_amount": "22",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        self.balance_eur.refresh_from_db()
        self.balance_usd.refresh_from_db()
        self.assertEqual(self.balance_eur.balance, Decimal("980"))
        self.assertEqual(self.balance_usd.balance, Decimal("522"))

        txn = Transaction.objects.get(pk=response.data["id"])
        self.assertEqual(txn.transfer_detail.fx_rate, Decimal("1.1"))

    def test_buy_and_sell_update_holdings_and_balances(self):
        security = Security.objects.create(
            name="SPDR S&P 500 ETF Trust",
            ticker="SPY",
            structure="etf",
            asset_class="equity",
            currency=self.usd,
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )

        buy_response = self.client.post(
            "/transactions/add",
            {
                "type": 3,
                "date": "2026-04-03",
                "from_cash_balance": self.balance_usd.id,
                "security": security.id,
                "quantity": "10",
                "price_per_unit": "5",
            },
            format="json",
        )
        self.assertEqual(buy_response.status_code, 201)

        self.balance_usd.refresh_from_db()
        self.assertEqual(self.balance_usd.balance, Decimal("450"))

        holding = Holding.objects.get(
            account=self.account_usd, security=security
        )
        self.assertEqual(holding.quantity, Decimal("10"))
        self.assertEqual(holding.average_cost, Decimal("5"))

        sell_response = self.client.post(
            "/transactions/add",
            {
                "type": 4,
                "date": "2026-04-04",
                "holding": holding.id,
                "to_cash_balance": self.balance_eur.id,
                "quantity": "4",
                "price_per_unit": "6",
            },
            format="json",
        )
        self.assertEqual(sell_response.status_code, 201)

        holding.refresh_from_db()
        self.balance_eur.refresh_from_db()
        self.assertEqual(holding.quantity, Decimal("6"))
        self.assertEqual(self.balance_eur.balance, Decimal("1024"))

    def test_buy_by_ticker_auto_creates_security_when_missing(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )
        response = self.client.post(
            "/transactions/add",
            {
                "type": 3,
                "date": "2026-04-07",
                "from_cash_balance": self.balance_usd.id,
                "security": "ORCL",
                "quantity": "2",
                "price_per_unit": "10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        security = Security.objects.get(ticker="ORCL")
        self.assertEqual(security.name, "ORCL")
        self.assertEqual(security.currency_id, self.usd.id)

        holding = Holding.objects.get(
            account=self.account_usd, security=security
        )
        self.assertEqual(holding.quantity, Decimal("2"))

    def test_delete_reverses_balance_changes(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )
        add_response = self.client.post(
            "/transactions/add",
            {
                "type": 1,
                "date": "2026-04-05",
                "amount": "30",
                "from_account": self.account_eur.id,
                "category": self.expense_category.id,
            },
            format="json",
        )
        self.assertEqual(add_response.status_code, 201)

        self.balance_eur.refresh_from_db()
        self.assertEqual(self.balance_eur.balance, Decimal("970"))

        delete_response = self.client.post(
            "/transactions/delete",
            {"id": add_response.data["id"]},
            format="json",
        )
        self.assertEqual(delete_response.status_code, 200)

        self.balance_eur.refresh_from_db()
        self.assertEqual(self.balance_eur.balance, Decimal("1000"))

    def test_wealth_stats_exclude_transactions_before_2023(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )

        for payload in (
            {
                "type": 0,
                "date": "2022-12-15",
                "amount": "500",
                "to_account": self.account_eur.id,
                "category": self.income_category.id,
            },
            {
                "type": 0,
                "date": "2023-01-15",
                "amount": "100",
                "to_account": self.account_eur.id,
                "category": self.income_category.id,
            },
            {
                "type": 1,
                "date": "2023-02-15",
                "amount": "20",
                "from_account": self.account_eur.id,
                "category": self.expense_category.id,
            },
        ):
            response = self.client.post(
                "/transactions/add",
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.get(
            "/transactions/get_wealth_stats", {"currency": "EUR"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["monthly_differences"],
            [
                {
                    "date": "2023-01",
                    "net_difference": 100.0,
                    "monthly_wealth": 2100.0,
                },
                {
                    "date": "2023-02",
                    "net_difference": -20.0,
                    "monthly_wealth": 2080.0,
                },
            ],
        )

    def test_wealth_stats_include_holdings_in_current_total(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )
        security = Security.objects.create(
            name="Test ETF",
            ticker="TETF",
            structure="etf",
            asset_class="equity",
            currency=self.eur,
        )
        Holding.objects.create(
            account=self.account_eur,
            security=security,
            quantity=Decimal("2"),
            average_cost=Decimal("100"),
        )

        response = self.client.post(
            "/transactions/add",
            {
                "type": 0,
                "date": "2023-01-15",
                "amount": "100",
                "to_account": self.account_eur.id,
                "category": self.income_category.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.get(
            "/transactions/get_wealth_stats", {"currency": "EUR"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["monthly_differences"][0]["monthly_wealth"],
            1800.0,
        )

    def test_food_stats_endpoint_is_removed(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )

        response = self.client.get(
            "/transactions/get_food_stats", {"currency": "EUR"}
        )

        self.assertEqual(response.status_code, 404)

    def test_validations_wrong_category_cross_user_ambiguous_and_oversell(
        self,
    ):
        self.client.credentials(
            HTTP_AUTHORIZATION=self._auth_header(raw=False)
        )

        # Wrong category type for income.
        response = self.client.post(
            "/transactions/add",
            {
                "type": 0,
                "date": "2026-04-06",
                "amount": "10",
                "to_account": self.account_eur.id,
                "category": self.expense_category.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # Cross-user cash balance cannot be used.
        response = self.client.post(
            "/transactions/add",
            {
                "type": 1,
                "date": "2026-04-06",
                "amount": "10",
                "from_cash_balance": self.other_balance.id,
                "category": self.expense_category.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # Ambiguous account with multiple balances requires balance/currency hint.
        extra_balance = CashBalance.objects.create(
            account=self.account_eur,
            currency=self.usd,
            balance=Decimal("15"),
        )
        self.assertIsNotNone(extra_balance.id)

        response = self.client.post(
            "/transactions/add",
            {
                "type": 1,
                "date": "2026-04-06",
                "amount": "10",
                "from_account": self.account_eur.id,
                "category": self.expense_category.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # Oversell is rejected.
        security = Security.objects.create(
            name="Vanguard S&P 500 ETF",
            ticker="VOO",
            structure="etf",
            asset_class="equity",
            currency=self.usd,
        )
        holding = Holding.objects.create(
            account=self.account_usd,
            security=security,
            quantity=Decimal("2"),
            average_cost=Decimal("10"),
        )
        response = self.client.post(
            "/transactions/add",
            {
                "type": 4,
                "date": "2026-04-06",
                "holding": holding.id,
                "to_cash_balance": self.balance_usd.id,
                "quantity": "5",
                "price_per_unit": "12",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class SmokeCategoryMigrationTests(TransactionTestCase):
    reset_sequences = True

    migrate_from = [("Transactions", "0007_remove_templates_feature_tables")]
    migrate_to = [("Transactions", "0008_delete_smoke_categories")]

    def setUp(self):
        super().setUp()
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        old_apps = self.executor.loader.project_state(self.migrate_from).apps

        user_model = old_apps.get_model("Users", "User")
        currency_model = old_apps.get_model("Accounts", "Currency")
        account_model = old_apps.get_model("Accounts", "Account")
        cash_balance_model = old_apps.get_model("Accounts", "CashBalance")
        transaction_model = old_apps.get_model("Transactions", "Transaction")
        transaction_category_model = old_apps.get_model(
            "Transactions", "TransactionCategory"
        )
        income_detail_model = old_apps.get_model(
            "Transactions", "IncomeDetail"
        )
        expense_detail_model = old_apps.get_model(
            "Transactions", "ExpenseDetail"
        )

        user = user_model.objects.create(
            name="Migration User",
            email="migration@example.com",
            phone="+19999999999",
            password="pass1234",
        )
        eur = currency_model.objects.create(
            code="EUR",
            name="Euro",
            symbol="EUR",
            currency_type="fiat",
        )
        account = account_model.objects.create(
            user=user,
            type=0,
            name="Migration Account",
            amount=Decimal("1000"),
            currency="EUR",
        )
        balance = cash_balance_model.objects.create(
            account=account,
            currency=eur,
            balance=Decimal("1000"),
        )

        smoke_income = transaction_category_model.objects.create(
            category="Smoke Salary",
            category_type=0,
        )
        smoke_expense = transaction_category_model.objects.create(
            category="Smoke Food",
            category_type=1,
        )
        transaction_category_model.objects.create(
            category="Salary",
            category_type=0,
        )
        transaction_category_model.objects.create(
            category="Food",
            category_type=1,
        )

        income_transaction = transaction_model.objects.create(
            user=user,
            transaction_type="income",
            date=date(2026, 4, 18),
        )
        expense_transaction = transaction_model.objects.create(
            user=user,
            transaction_type="expense",
            date=date(2026, 4, 18),
        )

        self.income_detail_id = income_detail_model.objects.create(
            transaction=income_transaction,
            to_cash_balance=balance,
            amount=Decimal("100"),
            category=smoke_income,
        ).id
        self.expense_detail_id = expense_detail_model.objects.create(
            transaction=expense_transaction,
            from_cash_balance=balance,
            amount=Decimal("50"),
            category=smoke_expense,
        ).id

        self.executor.migrate(self.migrate_to)
        self.apps = self.executor.loader.project_state(self.migrate_to).apps

    def test_migration_deletes_smoke_categories_and_nulls_linked_details(self):
        transaction_category_model = self.apps.get_model(
            "Transactions", "TransactionCategory"
        )
        income_detail_model = self.apps.get_model(
            "Transactions", "IncomeDetail"
        )
        expense_detail_model = self.apps.get_model(
            "Transactions", "ExpenseDetail"
        )

        self.assertFalse(
            transaction_category_model.objects.filter(
                category="Smoke Salary",
                category_type=0,
            ).exists()
        )
        self.assertFalse(
            transaction_category_model.objects.filter(
                category="Smoke Food",
                category_type=1,
            ).exists()
        )
        self.assertTrue(
            transaction_category_model.objects.filter(
                category="Salary",
                category_type=0,
            ).exists()
        )
        self.assertTrue(
            transaction_category_model.objects.filter(
                category="Food",
                category_type=1,
            ).exists()
        )

        income_detail = income_detail_model.objects.get(
            pk=self.income_detail_id
        )
        expense_detail = expense_detail_model.objects.get(
            pk=self.expense_detail_id
        )
        self.assertIsNone(income_detail.category_id)
        self.assertIsNone(expense_detail.category_id)

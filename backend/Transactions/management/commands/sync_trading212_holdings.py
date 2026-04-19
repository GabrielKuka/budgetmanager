import csv
import sqlite3
from collections import Counter
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from shutil import copy2

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from Accounts.models import Account, CashBalance, Currency, Holding, Security
from Transactions.models import SecurityTradeDetail, Transaction
from Users.models import User
from tags.models import Tag


IMPORT_TAG = "trading212-pie-import"
IMPORT_PREFIX = "[TRADING212 PIE IMPORT]"
ACCOUNT_ID = 34
EUR_CASH_BALANCE_ID = 16
USD_CASH_BALANCE_ID = 26
PIE_PURCHASE_DATE = date(2025, 9, 15)
CSH2_PURCHASE_DATE = date(2025, 1, 2)


@dataclass
class PlannedBuy:
    ticker: str
    name: str
    quantity: Decimal
    total_value: Decimal
    date: date
    structure: str
    asset_class: str
    currency_code: str

    @property
    def price_per_unit(self):
        return self.total_value / self.quantity


class Command(BaseCommand):
    help = "Backfill Trading212 pie stocks and CSH2 holding into the Accounts/Transactions schema."

    def add_arguments(self, parser):
        parser.add_argument("--user-email", required=True)
        parser.add_argument("--csv-path", default="../budgetdb/pie.csv")
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--backup-path", default=None)

    def handle(self, *args, **options):
        user = User.objects.filter(
            email__iexact=options["user_email"].strip()
        ).first()
        if not user:
            raise CommandError(f"User not found: {options['user_email']!r}")

        csv_path = Path(options["csv_path"]).expanduser()
        if not csv_path.is_absolute():
            csv_path = (Path.cwd() / csv_path).resolve()
        if not csv_path.exists():
            raise CommandError(f"CSV file not found: {csv_path}")

        account = Account.objects.filter(pk=ACCOUNT_ID, user=user).first()
        if not account:
            raise CommandError(
                f"Trading212 account {ACCOUNT_ID} not found for user {user.email}."
            )

        eur_cash_balance = self._get_cash_balance(
            EUR_CASH_BALANCE_ID, account, "EUR"
        )
        self._get_cash_balance(USD_CASH_BALANCE_ID, account, "USD")

        planned_buys = self._parse_pie_csv(csv_path)
        planned_buys.append(
            PlannedBuy(
                ticker="CSH2",
                name="Amundi Smart Overnight Return",
                quantity=Decimal("9.4894657"),
                total_value=Decimal("9.4894657") * Decimal("105.38"),
                date=CSH2_PURCHASE_DATE,
                structure="etf",
                asset_class="money_market",
                currency_code="EUR",
            )
        )

        tag = Tag.objects.filter(name=IMPORT_TAG).first()
        existing_tagged = (
            Transaction.objects.filter(user=user, tags=tag).count()
            if tag
            else 0
        )
        securities_to_create, securities_to_reuse = self._security_plan(
            planned_buys
        )
        total_debit = sum(
            (buy.total_value for buy in planned_buys), Decimal("0")
        )

        self.stdout.write(
            self.style.NOTICE(
                f"user={user.email} account={account.id} mode={'APPLY' if options['apply'] else 'DRY-RUN'}"
            )
        )
        self.stdout.write(f"csv={csv_path}")
        self.stdout.write(
            f"pie_rows={len(planned_buys) - 1}, csh2_rows=1, total_buys={len(planned_buys)}"
        )
        self.stdout.write(
            f"pie_total_eur={self._q2(total_debit - planned_buys[-1].total_value)}"
        )
        self.stdout.write(
            f"csh2_total_eur={self._q2(planned_buys[-1].total_value)}"
        )
        self.stdout.write(f"total_eur_debit={self._q2(total_debit)}")
        self.stdout.write(
            f"projected_eur_balance={self._q2((eur_cash_balance.balance or Decimal('0')) - total_debit)}"
        )
        self.stdout.write(
            f"securities_to_create={len(securities_to_create)}, "
            f"securities_to_reuse={len(securities_to_reuse)}, existing_tagged_rows={existing_tagged}"
        )

        if not options["apply"]:
            self.stdout.write(
                self.style.SUCCESS("Dry-run complete. No data changed.")
            )
            return

        if options.get("backup_path"):
            backup_file = self._create_db_backup(options["backup_path"])
            self.stdout.write(
                self.style.SUCCESS(f"Database backup created: {backup_file}")
            )

        with transaction.atomic():
            import_tag, _ = Tag.objects.get_or_create(name=IMPORT_TAG)
            deleted = self._delete_existing_import(user, import_tag)
            securities = self._ensure_securities(planned_buys)

            inserted = Counter()
            for buy in planned_buys:
                security = securities[buy.ticker]
                self._create_buy(
                    user, account, eur_cash_balance, security, buy, import_tag
                )
                inserted["buy"] += 1

            rebuilt = self._rebuild_holdings(
                user, account, securities.values()
            )
            self._assert_post_conditions(
                user, account, eur_cash_balance, planned_buys
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Trading212 import applied: deleted={deleted}, inserted={dict(inserted)}, holdings={rebuilt}"
            )
        )

    def _parse_pie_csv(self, csv_path):
        buys = []
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                ticker = (row.get("Slice") or "").strip()
                if not ticker or ticker.lower() == "total":
                    continue

                quantity = self._d(row.get("Owned quantity"))
                total_value = self._d(row.get("Invested value"))
                if quantity <= 0:
                    continue

                buys.append(
                    PlannedBuy(
                        ticker=ticker.upper(),
                        name=(row.get("Name") or ticker).strip(),
                        quantity=quantity,
                        total_value=total_value,
                        date=PIE_PURCHASE_DATE,
                        structure="stock",
                        asset_class="equity",
                        currency_code="USD",
                    )
                )

        if len(buys) != 50:
            raise CommandError(
                f"Expected 50 included pie rows, got {len(buys)}."
            )
        invested_total = sum((buy.total_value for buy in buys), Decimal("0"))
        if self._q2(invested_total) != Decimal("1499.21"):
            raise CommandError(
                f"Unexpected pie invested total: {invested_total}"
            )
        return buys

    def _get_cash_balance(self, pk, account, expected_code):
        cash_balance = (
            CashBalance.objects.select_related("currency")
            .filter(pk=pk, account=account)
            .first()
        )
        if not cash_balance or cash_balance.currency.code != expected_code:
            raise CommandError(
                f"Expected cash balance {pk} to be {expected_code} on account {account.id}."
            )
        return cash_balance

    def _security_plan(self, planned_buys):
        existing = set(
            Security.objects.filter(
                ticker__in=[buy.ticker for buy in planned_buys]
            ).values_list("ticker", flat=True)
        )
        to_create = [
            buy.ticker for buy in planned_buys if buy.ticker not in existing
        ]
        to_reuse = [
            buy.ticker for buy in planned_buys if buy.ticker in existing
        ]
        return sorted(to_create), sorted(to_reuse)

    def _ensure_securities(self, planned_buys):
        currencies = {
            currency.code: currency
            for currency in Currency.objects.filter(
                code__in={buy.currency_code for buy in planned_buys}
            )
        }
        securities = {}
        for buy in planned_buys:
            currency = currencies.get(buy.currency_code)
            if not currency:
                raise CommandError(f"Missing currency {buy.currency_code}.")
            security, _ = Security.objects.get_or_create(
                ticker=buy.ticker,
                defaults={
                    "name": buy.name,
                    "structure": buy.structure,
                    "asset_class": buy.asset_class,
                    "currency": currency,
                },
            )
            securities[buy.ticker] = security
        return securities

    def _delete_existing_import(self, user, tag):
        queryset = (
            Transaction.objects.filter(user=user, tags=tag)
            .distinct()
            .order_by("-id")
        )
        count = queryset.count()
        for txn in queryset:
            self._reverse_and_delete(txn)
        return count

    def _create_buy(self, user, account, cash_balance, security, buy, tag):
        txn = Transaction.objects.create(
            user=user,
            transaction_type="buy",
            date=buy.date,
            description=self._desc(f"{IMPORT_PREFIX} {buy.ticker}"),
            amount=self._q4(buy.total_value),
            from_account=account,
            to_account=None,
        )
        txn.tags.add(tag)
        SecurityTradeDetail.objects.create(
            transaction=txn,
            security=security,
            cash_balance=cash_balance,
            quantity=self._q8(buy.quantity),
            price_per_unit=self._q8(buy.price_per_unit),
        )
        self._apply_cash_delta(cash_balance, -buy.total_value)

    def _rebuild_holdings(self, user, account, securities):
        updated = 0
        for security in securities:
            trades = (
                SecurityTradeDetail.objects.filter(
                    transaction__user=user,
                    cash_balance__account=account,
                    security=security,
                )
                .select_related("transaction")
                .order_by("transaction__date", "transaction_id")
            )

            quantity = Decimal("0")
            average_cost = Decimal("0")
            for detail in trades:
                if detail.transaction.transaction_type == "buy":
                    total_cost = (
                        quantity * average_cost
                        + detail.quantity * detail.price_per_unit
                    )
                    quantity += detail.quantity
                    average_cost = (
                        total_cost / quantity if quantity else Decimal("0")
                    )
                elif detail.transaction.transaction_type == "sell":
                    quantity -= detail.quantity
                    if quantity < 0:
                        raise CommandError(
                            f"Holding rebuild failed for {security.ticker}."
                        )

            holding, _ = Holding.objects.get_or_create(
                account=account, security=security
            )
            holding.quantity = self._q8(quantity)
            holding.average_cost = self._q8(average_cost)
            holding.save(
                update_fields=["quantity", "average_cost", "updated_on"]
            )
            SecurityTradeDetail.objects.filter(
                transaction__user=user,
                cash_balance__account=account,
                security=security,
            ).update(holding_id=holding.id)
            updated += 1

        return {"updated": updated}

    def _assert_post_conditions(
        self, user, account, cash_balance, planned_buys
    ):
        tagged_count = (
            Transaction.objects.filter(user=user, tags__name=IMPORT_TAG)
            .distinct()
            .count()
        )
        if tagged_count != len(planned_buys):
            raise CommandError(
                f"Tagged transaction count mismatch: {tagged_count} != {len(planned_buys)}"
            )

        holding_count = Holding.objects.filter(
            account=account,
            security__ticker__in=[buy.ticker for buy in planned_buys],
        ).count()
        if holding_count != len(planned_buys):
            raise CommandError(
                f"Holding count mismatch: {holding_count} != {len(planned_buys)}"
            )

        fx_fee_count = Transaction.objects.filter(
            user=user,
            date=PIE_PURCHASE_DATE,
            transaction_type="expense",
            description__icontains="FX fee for Daily Dividend Pie investment",
        ).count()
        if fx_fee_count != 1:
            raise CommandError(
                f"Expected one existing FX fee row, found {fx_fee_count}."
            )

        usd_balance = CashBalance.objects.get(pk=USD_CASH_BALANCE_ID)
        if self._q2(usd_balance.balance) != Decimal("5562.21"):
            raise CommandError(
                f"USD cash balance changed unexpectedly: {usd_balance.balance}"
            )

        with connection.cursor() as cursor:
            cursor.execute("PRAGMA foreign_key_check")
            fk_errors = cursor.fetchall()
        if fk_errors:
            raise CommandError(f"Foreign key check failed: {fk_errors[:5]}")

    def _reverse_and_delete(self, txn):
        if txn.transaction_type == "buy" and hasattr(
            txn, "security_trade_detail"
        ):
            detail = txn.security_trade_detail
            self._apply_cash_delta(detail.cash_balance, detail.total_value)
        elif txn.transaction_type == "sell" and hasattr(
            txn, "security_trade_detail"
        ):
            detail = txn.security_trade_detail
            self._apply_cash_delta(detail.cash_balance, -detail.total_value)
        txn.delete()

    def _apply_cash_delta(self, cash_balance, delta):
        cash_balance = CashBalance.objects.select_for_update().get(
            pk=cash_balance.pk
        )
        cash_balance.balance = (cash_balance.balance or Decimal("0")) + delta
        cash_balance.save(update_fields=["balance", "updated_on"])

    def _create_db_backup(self, backup_path):
        db_name = connection.settings_dict.get("NAME")
        source_path = Path(str(db_name))
        if not source_path.is_absolute():
            source_path = (Path.cwd() / source_path).resolve()

        destination_input = Path(str(backup_path))
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        if destination_input.exists() and destination_input.is_dir():
            destination = (
                destination_input
                / f"{source_path.name}.trading212_import_{timestamp}"
            )
        elif not destination_input.exists() and (
            str(backup_path).endswith("/") or destination_input.suffix == ""
        ):
            destination_input.mkdir(parents=True, exist_ok=True)
            destination = (
                destination_input
                / f"{source_path.name}.trading212_import_{timestamp}"
            )
        else:
            destination = destination_input

        destination.parent.mkdir(parents=True, exist_ok=True)
        if "sqlite3" in connection.settings_dict.get("ENGINE", ""):
            connection.ensure_connection()
            with sqlite3.connect(str(destination)) as backup_conn:
                connection.connection.backup(backup_conn)
        else:
            copy2(source_path, destination)
        return destination

    def _d(self, value):
        raw = str(value or "0").replace(",", "").strip()
        if raw in ("", "-", "N/A"):
            return Decimal("0")
        return Decimal(raw)

    def _desc(self, value):
        return (value or "")[:200]

    def _q8(self, value):
        return Decimal(value).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP
        )

    def _q4(self, value):
        return Decimal(value).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

    def _q2(self, value):
        return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

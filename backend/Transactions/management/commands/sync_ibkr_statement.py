import csv
import sqlite3
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from shutil import copy2

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from Accounts.models import Account, CashBalance, Holding, Security
from Transactions.models import (
    ExpenseDetail,
    IncomeDetail,
    SecurityTradeDetail,
    Transaction,
    TransactionCategory,
    TransferDetail,
)
from Users.models import User
from tags.models import Tag


SYNC_TAG = "ibkr-statement-sync"
OLD_IMPORT_TAG = "ibkr-csv-import"
PREFIX = "[IBKR STATEMENT SYNC]"
RECON_PREFIX = "[IBKR STATEMENT CASH RECONCILIATION]"
SYMBOL_NORMALIZATION = {"CSPX": "SXR8"}


@dataclass
class ParsedTrade:
    row: dict
    date: datetime.date
    tx_type: str
    symbol: str
    security_id: int
    cash_balance_id: int
    quantity: Decimal
    price_per_unit: Decimal
    total_value: Decimal


class Command(BaseCommand):
    help = "Synchronize the IBKR account from a full IBKR Transaction History CSV."

    def add_arguments(self, parser):
        parser.add_argument("--user-email", required=True)
        parser.add_argument("--csv-path", default="../budgetdb/transactions.csv")
        parser.add_argument("--ibkr-account-code", default="U***61755")
        parser.add_argument("--ibkr-account-id", type=int, default=8)
        parser.add_argument("--usd-cash-balance-id", type=int, default=5)
        parser.add_argument("--eur-cash-balance-id", type=int, default=28)
        parser.add_argument("--target-usd-cash", default="312.25")
        parser.add_argument("--target-eur-cash", default="3080.14")
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--backup-path", default=None)

    def handle(self, *args, **options):
        user = User.objects.filter(email__iexact=options["user_email"].strip()).first()
        if not user:
            raise CommandError(f"User not found: {options['user_email']!r}")

        csv_path = Path(options["csv_path"]).expanduser()
        if not csv_path.is_absolute():
            csv_path = (Path.cwd() / csv_path).resolve()
        if not csv_path.exists():
            raise CommandError(f"CSV file not found: {csv_path}")

        account = Account.objects.filter(id=options["ibkr_account_id"], user=user).first()
        if not account:
            raise CommandError(f"IBKR account not found for user: {options['ibkr_account_id']}")

        cb_usd = self._get_cash_balance(options["usd_cash_balance_id"], account, "USD")
        cb_eur = self._get_cash_balance(options["eur_cash_balance_id"], account, "EUR")
        cash_by_code = {"USD": cb_usd, "EUR": cb_eur}
        target_cash = {
            "USD": self._d(options["target_usd_cash"]),
            "EUR": self._d(options["target_eur_cash"]),
        }

        rows = self._parse_rows(csv_path, options["ibkr_account_code"].strip())
        trades = [row for row in rows if row["transaction type"] in ("Buy", "Sell")]
        parsed_trades = self._parse_trades(trades, cash_by_code)
        type_counts = Counter(row["transaction type"] for row in rows)

        self.stdout.write(
            self.style.NOTICE(
                f"user={user.email} account={account.id} mode={'APPLY' if options['apply'] else 'DRY-RUN'}"
            )
        )
        self.stdout.write(f"csv={csv_path}")
        self.stdout.write(
            "parsed rows="
            f"{len(rows)} | "
            + ", ".join(f"{key}={type_counts[key]}" for key in sorted(type_counts))
        )
        self.stdout.write(
            f"buy/sell parsed={len(parsed_trades)} "
            f"(buy={type_counts['Buy']}, sell={type_counts['Sell']})"
        )

        plan = self._build_plan(user, account, rows)
        self._print_plan(plan)

        if not options["apply"]:
            self.stdout.write(self.style.SUCCESS("Dry-run complete. No data changed."))
            return

        if options.get("backup_path"):
            backup_file = self._create_db_backup(options["backup_path"])
            self.stdout.write(self.style.SUCCESS(f"Database backup created: {backup_file}"))

        with transaction.atomic():
            sync_tag, _ = Tag.objects.get_or_create(name=SYNC_TAG)
            old_tag = Tag.objects.filter(name=OLD_IMPORT_TAG).first()

            deleted_tagged = self._delete_tagged_imports(user, [tag for tag in (sync_tag, old_tag) if tag])
            deleted_manual = self._delete_manual_ibkr_income_expenses(
                user,
                account,
                plan["date_min"],
                plan["date_max"],
            )

            inserted = Counter()
            for trade in parsed_trades:
                self._create_trade(user, account, trade, sync_tag)
                inserted[trade.tx_type] += 1

            for row in rows:
                row_type = row["transaction type"]
                if row_type == "Forex Trade Component":
                    self._create_forex_transfer(user, account, row, cash_by_code, sync_tag)
                    inserted["forex"] += 1
                elif row_type in ("Dividend", "Credit Interest"):
                    self._create_statement_income(user, account, row, cash_by_code, sync_tag)
                    inserted["income"] += 1
                elif row_type in ("Foreign Tax Withholding", "Debit Interest"):
                    self._create_statement_expense(user, account, row, cash_by_code, sync_tag)
                    inserted["expense"] += 1
                elif row_type in ("Deposit", "Withdrawal"):
                    if not self._has_matching_transfer(user, account, row):
                        self._create_cash_adjustment(user, account, row, cash_by_code, sync_tag)
                        inserted["cash_adjustment"] += 1

            rebuilt = self._rebuild_holdings(user, account, parsed_trades)
            reconciled = self._reconcile_to_targets(user, account, cash_by_code, target_cash, sync_tag, rows)

            self._assert_post_conditions(user, account, cash_by_code, target_cash)

        self.stdout.write(
            self.style.SUCCESS(
                "IBKR statement sync applied: "
                f"deleted_tagged={deleted_tagged}, deleted_manual={deleted_manual}, "
                f"inserted={dict(inserted)}, holdings={rebuilt}, reconciled={reconciled}"
            )
        )

    def _get_cash_balance(self, pk, account, expected_code):
        cash_balance = CashBalance.objects.select_related("currency", "account").filter(
            pk=pk,
            account=account,
        ).first()
        if not cash_balance or cash_balance.currency.code != expected_code:
            raise CommandError(f"Expected cash balance {pk} to be {expected_code} on account {account.id}.")
        return cash_balance

    def _parse_rows(self, csv_path, account_code):
        rows = []
        headers = None
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.reader(fh)
            for raw in reader:
                if len(raw) >= 2 and raw[0] == "Transaction History" and raw[1] == "Header":
                    headers = [column.strip() for column in raw[2:]]
                    continue
                if len(raw) >= 2 and raw[0] == "Transaction History" and raw[1] == "Data":
                    if not headers:
                        raise CommandError("CSV Transaction History header not found.")
                    row = {
                        headers[idx].strip().lower(): raw[idx + 2].strip() if idx + 2 < len(raw) else ""
                        for idx in range(len(headers))
                    }
                    if row.get("account") == account_code:
                        rows.append(row)

        if not rows:
            raise CommandError("No matching IBKR rows found in CSV.")
        rows.sort(key=lambda row: (row["date"], row["transaction type"], row.get("symbol", "")))
        return rows

    def _parse_trades(self, rows, cash_by_code):
        parsed = []
        for row in rows:
            symbol = SYMBOL_NORMALIZATION.get(row["symbol"].upper(), row["symbol"].upper())
            security = Security.objects.filter(ticker=symbol).first()
            if not security:
                raise CommandError(f"Missing security for ticker {symbol}.")

            quantity = abs(self._d(row["quantity"]))
            price_currency = row["price currency"].upper()
            cash_balance = cash_by_code.get(price_currency)
            if not cash_balance:
                raise CommandError(f"Unsupported trade currency {price_currency} in row {row}.")

            total = self._trade_total(row, quantity)
            parsed.append(
                ParsedTrade(
                    row=row,
                    date=self._date(row),
                    tx_type=row["transaction type"].lower(),
                    symbol=symbol,
                    security_id=security.id,
                    cash_balance_id=cash_balance.id,
                    quantity=quantity,
                    price_per_unit=total / quantity,
                    total_value=total,
                )
            )
        parsed.sort(key=lambda trade: (trade.date, trade.symbol, trade.tx_type))
        return parsed

    def _build_plan(self, user, account, rows):
        date_values = [self._date(row) for row in rows]
        return {
            "date_min": min(date_values),
            "date_max": max(date_values),
            "tagged_rows": Transaction.objects.filter(
                user=user,
                tags__name__in=[SYNC_TAG, OLD_IMPORT_TAG],
            ).distinct().count(),
            "manual_income_expense_rows": self._manual_ibkr_income_expense_qs(
                user,
                account,
                min(date_values),
                max(date_values),
            ).count(),
            "matched_cash_rows": sum(1 for row in rows if row["transaction type"] in ("Deposit", "Withdrawal") and self._has_matching_transfer(user, account, row)),
            "unmatched_cash_rows": sum(1 for row in rows if row["transaction type"] in ("Deposit", "Withdrawal") and not self._has_matching_transfer(user, account, row)),
        }

    def _print_plan(self, plan):
        self.stdout.write(
            "plan: "
            f"date_range={plan['date_min']}..{plan['date_max']}, "
            f"tagged_to_replace={plan['tagged_rows']}, "
            f"manual_ibkr_income_expense_to_replace={plan['manual_income_expense_rows']}, "
            f"matched_cash_transfers={plan['matched_cash_rows']}, "
            f"unmatched_cash_adjustments={plan['unmatched_cash_rows']}"
        )

    def _delete_tagged_imports(self, user, tags):
        queryset = Transaction.objects.filter(user=user, tags__in=tags).distinct().order_by("-id")
        count = queryset.count()
        for txn in queryset:
            self._reverse_and_delete(txn)
        return count

    def _manual_ibkr_income_expense_qs(self, user, account, date_min, date_max):
        return (
            Transaction.objects.filter(user=user, date__gte=date_min, date__lte=date_max)
            .filter(
                transaction_type__in=["income", "expense"],
            )
            .filter(
                income_detail__to_cash_balance__account=account,
            )
            | Transaction.objects.filter(user=user, date__gte=date_min, date__lte=date_max)
            .filter(transaction_type__in=["income", "expense"])
            .filter(expense_detail__from_cash_balance__account=account)
        ).distinct()

    def _delete_manual_ibkr_income_expenses(self, user, account, date_min, date_max):
        queryset = self._manual_ibkr_income_expense_qs(user, account, date_min, date_max).order_by("-id")
        count = queryset.count()
        for txn in queryset:
            self._reverse_and_delete(txn)
        return count

    def _create_trade(self, user, account, trade, tag):
        txn = Transaction.objects.create(
            user=user,
            transaction_type=trade.tx_type,
            date=trade.date,
            description=self._desc(f"{PREFIX} {trade.row['description']}"),
            amount=self._q4(trade.total_value),
            from_account=account if trade.tx_type == "buy" else None,
            to_account=account if trade.tx_type == "sell" else None,
        )
        txn.tags.add(tag)
        SecurityTradeDetail.objects.create(
            transaction=txn,
            security_id=trade.security_id,
            cash_balance_id=trade.cash_balance_id,
            quantity=self._q8(trade.quantity),
            price_per_unit=self._q8(trade.price_per_unit),
        )
        cash_balance = CashBalance.objects.select_for_update().get(pk=trade.cash_balance_id)
        delta = -trade.total_value if trade.tx_type == "buy" else trade.total_value
        self._apply_cash_delta(cash_balance, delta)

    def _create_forex_transfer(self, user, account, row, cash_by_code, tag):
        symbol = row["symbol"].upper()
        if symbol != "EUR.USD":
            raise CommandError(f"Unsupported forex symbol: {symbol}")

        quantity = self._d(row["quantity"])
        price = self._d(row["price"])
        if quantity >= 0:
            raise CommandError(f"Unsupported forex direction for row: {row}")

        from_cb = cash_by_code["EUR"]
        to_cb = cash_by_code["USD"]
        amount = abs(quantity)
        fx_rate = price
        txn = Transaction.objects.create(
            user=user,
            transaction_type="transfer",
            date=self._date(row),
            description=self._desc(f"{PREFIX} {row['description']}"),
            amount=self._q4(amount),
            from_account=account,
            to_account=account,
        )
        txn.tags.add(tag)
        TransferDetail.objects.create(
            transaction=txn,
            from_cash_balance=from_cb,
            to_cash_balance=to_cb,
            amount=self._q4(amount),
            fx_rate=self._q8(fx_rate),
        )
        self._apply_cash_delta(from_cb, -amount)
        self._apply_cash_delta(to_cb, amount * fx_rate)

        commission = self._d(row.get("commission"))
        if commission is not None and commission != 0:
            self._create_expense(
                user=user,
                account=account,
                cash_balance=to_cb,
                amount=abs(commission),
                date=self._date(row),
                description=f"{PREFIX} FX commission {row['symbol']}",
                tag=tag,
                category=self._category("Fees", 1),
            )

    def _create_statement_income(self, user, account, row, cash_by_code, tag):
        cash_balance = self._cash_balance_for_statement_row(row, cash_by_code)
        category_name = "Dividends" if row["transaction type"] == "Dividend" else "Interests"
        self._create_income(
            user=user,
            account=account,
            cash_balance=cash_balance,
            amount=abs(self._d(row["net amount"])),
            date=self._date(row),
            description=f"{PREFIX} {row['description']}",
            tag=tag,
            category=self._category(category_name, 0),
        )

    def _create_statement_expense(self, user, account, row, cash_by_code, tag):
        cash_balance = self._cash_balance_for_statement_row(row, cash_by_code)
        self._create_expense(
            user=user,
            account=account,
            cash_balance=cash_balance,
            amount=abs(self._d(row["net amount"])),
            date=self._date(row),
            description=f"{PREFIX} {row['description']}",
            tag=tag,
            category=self._category("Fees", 1),
        )

    def _create_cash_adjustment(self, user, account, row, cash_by_code, tag):
        amount = abs(self._d(row["net amount"]))
        cash_balance = self._infer_cash_balance_for_cash_row(row, cash_by_code)
        if row["transaction type"] == "Deposit":
            self._create_income(
                user=user,
                account=account,
                cash_balance=cash_balance,
                amount=amount,
                date=self._date(row),
                description=f"{PREFIX} unmatched IBKR deposit",
                tag=tag,
                category=self._category("Other", 0),
            )
        else:
            self._create_expense(
                user=user,
                account=account,
                cash_balance=cash_balance,
                amount=amount,
                date=self._date(row),
                description=f"{PREFIX} unmatched IBKR withdrawal",
                tag=tag,
                category=self._category("Other", 1),
            )

    def _has_matching_transfer(self, user, account, row):
        row_date = self._date(row)
        queryset = Transaction.objects.filter(
            user=user,
            transaction_type="transfer",
            date=row_date,
        )
        if row["transaction type"] == "Deposit":
            return queryset.filter(transfer_detail__to_cash_balance__account=account).exists()
        if row["transaction type"] == "Withdrawal":
            # One existing withdrawal is dated one day after the statement row.
            return Transaction.objects.filter(
                user=user,
                transaction_type="transfer",
                date__gte=row_date,
                date__lte=row_date.replace(day=row_date.day + 1),
                transfer_detail__from_cash_balance__account=account,
            ).exists()
        return False

    def _create_income(self, user, account, cash_balance, amount, date, description, tag, category):
        txn = Transaction.objects.create(
            user=user,
            transaction_type="income",
            date=date,
            description=self._desc(description),
            amount=self._q4(amount),
            category=category,
            from_account=None,
            to_account=account,
        )
        txn.tags.add(tag)
        IncomeDetail.objects.create(
            transaction=txn,
            to_cash_balance=cash_balance,
            amount=self._q4(amount),
            category=category,
        )
        self._apply_cash_delta(cash_balance, amount)
        return txn

    def _create_expense(self, user, account, cash_balance, amount, date, description, tag, category):
        txn = Transaction.objects.create(
            user=user,
            transaction_type="expense",
            date=date,
            description=self._desc(description),
            amount=self._q4(amount),
            category=category,
            from_account=account,
            to_account=None,
        )
        txn.tags.add(tag)
        ExpenseDetail.objects.create(
            transaction=txn,
            from_cash_balance=cash_balance,
            amount=self._q4(amount),
            category=category,
        )
        self._apply_cash_delta(cash_balance, -amount)
        return txn

    def _rebuild_holdings(self, user, account, parsed_trades):
        symbols = sorted({trade.symbol for trade in parsed_trades})
        updated = 0
        removed = 0
        for symbol in symbols:
            security = Security.objects.get(ticker=symbol)
            trades = (
                SecurityTradeDetail.objects.filter(
                    transaction__user=user,
                    cash_balance__account=account,
                    security=security,
                )
                .select_related("transaction")
                .order_by("transaction__date", "transaction_id")
            )
            qty = Decimal("0")
            avg = Decimal("0")
            for detail in trades:
                if detail.transaction.transaction_type == "buy":
                    total_cost = qty * avg + detail.quantity * detail.price_per_unit
                    qty += detail.quantity
                    avg = total_cost / qty if qty else Decimal("0")
                elif detail.transaction.transaction_type == "sell":
                    qty -= detail.quantity
                    if qty < Decimal("-0.00000001"):
                        raise CommandError(f"Sell quantity exceeds holding for {symbol}.")
                    if abs(qty) <= Decimal("0.00000001"):
                        qty = Decimal("0")
                        avg = Decimal("0")

            holding = Holding.objects.filter(account=account, security=security).first()
            if qty > 0:
                if not holding:
                    holding = Holding.objects.create(account=account, security=security)
                holding.quantity = self._q8(qty)
                holding.average_cost = self._q8(avg)
                holding.save(update_fields=["quantity", "average_cost", "updated_on"])
                SecurityTradeDetail.objects.filter(
                    transaction__user=user,
                    cash_balance__account=account,
                    security=security,
                ).update(holding_id=holding.id)
                updated += 1
            else:
                SecurityTradeDetail.objects.filter(
                    transaction__user=user,
                    cash_balance__account=account,
                    security=security,
                ).update(holding=None)
                if holding:
                    holding.delete()
                    removed += 1
        return {"updated": updated, "removed": removed}

    def _reconcile_to_targets(self, user, account, cash_by_code, target_cash, tag, rows):
        count = 0
        max_date = max(self._date(row) for row in rows)
        for code, target in target_cash.items():
            cash_balance = CashBalance.objects.select_for_update().get(pk=cash_by_code[code].pk)
            current = cash_balance.balance or Decimal("0")
            delta = target - current
            if abs(delta) <= Decimal("0.0001"):
                continue
            if delta > 0:
                self._create_income(
                    user,
                    account,
                    cash_balance,
                    delta,
                    max_date,
                    f"{RECON_PREFIX} {code}",
                    tag,
                    self._category("Other", 0),
                )
            else:
                self._create_expense(
                    user,
                    account,
                    cash_balance,
                    abs(delta),
                    max_date,
                    f"{RECON_PREFIX} {code}",
                    tag,
                    self._category("Other", 1),
                )
            count += 1
        return count

    def _reverse_and_delete(self, txn):
        if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
            detail = txn.income_detail
            self._apply_cash_delta(detail.to_cash_balance, -detail.amount)
        elif txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
            detail = txn.expense_detail
            self._apply_cash_delta(detail.from_cash_balance, detail.amount)
        elif txn.transaction_type == "transfer" and hasattr(txn, "transfer_detail"):
            detail = txn.transfer_detail
            self._apply_cash_delta(detail.from_cash_balance, detail.amount)
            self._apply_cash_delta(detail.to_cash_balance, -(detail.amount * detail.fx_rate))
        elif txn.transaction_type == "buy" and hasattr(txn, "security_trade_detail"):
            detail = txn.security_trade_detail
            self._apply_cash_delta(detail.cash_balance, detail.total_value)
        elif txn.transaction_type == "sell" and hasattr(txn, "security_trade_detail"):
            detail = txn.security_trade_detail
            self._apply_cash_delta(detail.cash_balance, -detail.total_value)
        txn.delete()

    def _assert_post_conditions(self, user, account, cash_by_code, target_cash):
        for code, target in target_cash.items():
            cash_by_code[code].refresh_from_db(fields=["balance"])
            actual = cash_by_code[code].balance or Decimal("0")
            if self._q2(actual) != self._q2(target):
                raise CommandError(f"{code} cash mismatch: {self._q2(actual)} != {self._q2(target)}")

        expected = {
            "CSH2": (Decimal("231.4975"), Decimal("25013.81")),
            "SPY": (Decimal("15.8252"), Decimal("8945.64")),
            "SXR8": (Decimal("5.1817"), Decimal("3259.63")),
            "ERNX": (Decimal("473.6767"), Decimal("2621.60")),
            "VOO": (Decimal("1.5669"), Decimal("950.61")),
            "MSFT": (Decimal("1"), Decimal("372.99")),
            "XNAS": (Decimal("1.571"), Decimal("81.25")),
        }
        for ticker, (quantity, cost_basis) in expected.items():
            holding = Holding.objects.filter(account=account, security__ticker=ticker).first()
            if not holding:
                raise CommandError(f"Missing expected holding {ticker}.")
            if self._q4(holding.quantity) != self._q4(quantity):
                raise CommandError(f"{ticker} quantity mismatch: {holding.quantity} != {quantity}")
            if self._q2(holding.quantity * holding.average_cost) != self._q2(cost_basis):
                raise CommandError(f"{ticker} cost basis mismatch.")

        for ticker in ("VTI", "SGOV"):
            holding = Holding.objects.filter(account=account, security__ticker=ticker).first()
            if holding and abs(holding.quantity or Decimal("0")) > Decimal("0.00000001"):
                raise CommandError(f"{ticker} should be fully sold, found {holding.quantity}.")

        with connection.cursor() as cursor:
            cursor.execute("PRAGMA foreign_key_check")
            fk_errors = cursor.fetchall()
        if fk_errors:
            raise CommandError(f"Foreign key check failed: {fk_errors[:5]}")

    def _trade_total(self, row, quantity):
        price_currency = row["price currency"].upper()
        net_amount = self._d(row["net amount"])
        if price_currency == "EUR":
            return abs(net_amount)

        price = self._d(row["price"])
        gross = self._d(row["gross amount"])
        commission = self._d(row.get("commission")) or Decimal("0")
        notional = abs(quantity * price)
        fx_eur_per_usd = abs(gross) / notional
        commission_usd = abs(commission) / fx_eur_per_usd if commission else Decimal("0")
        if row["transaction type"] == "Buy":
            return notional + commission_usd
        return notional - commission_usd

    def _cash_balance_for_statement_row(self, row, cash_by_code):
        if row["symbol"] and row["symbol"] != "-":
            symbol = SYMBOL_NORMALIZATION.get(row["symbol"].upper(), row["symbol"].upper())
            security = Security.objects.filter(ticker=symbol).select_related("currency").first()
            if security and security.currency.code in cash_by_code:
                return cash_by_code[security.currency.code]
        if "EUR" in row["description"]:
            return cash_by_code["EUR"]
        if "USD" in row["description"]:
            return cash_by_code["USD"]
        return cash_by_code["EUR"]

    def _infer_cash_balance_for_cash_row(self, row, cash_by_code):
        if row["date"] == "2022-10-31":
            return cash_by_code["EUR"]
        if "EUR" in row["description"]:
            return cash_by_code["EUR"]
        return cash_by_code["USD"]

    def _apply_cash_delta(self, cash_balance, delta):
        cash_balance = CashBalance.objects.select_for_update().get(pk=cash_balance.pk)
        cash_balance.balance = (cash_balance.balance or Decimal("0")) + delta
        cash_balance.save(update_fields=["balance", "updated_on"])

    def _category(self, name, category_type):
        category = TransactionCategory.objects.filter(
            category__iexact=name,
            category_type=category_type,
        ).first()
        if not category:
            label = "income" if category_type == 0 else "expense"
            raise CommandError(f"Missing {label} category: {name}")
        return category

    def _create_db_backup(self, backup_path):
        db_name = connection.settings_dict.get("NAME")
        source_path = Path(str(db_name))
        if not source_path.is_absolute():
            source_path = (Path.cwd() / source_path).resolve()

        destination_input = Path(str(backup_path))
        destination = destination_input
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        if destination_input.exists() and destination_input.is_dir():
            destination = destination_input / f"{source_path.name}.ibkr_sync_{timestamp}"
        elif not destination_input.exists() and (str(backup_path).endswith("/") or destination_input.suffix == ""):
            destination_input.mkdir(parents=True, exist_ok=True)
            destination = destination_input / f"{source_path.name}.ibkr_sync_{timestamp}"

        destination.parent.mkdir(parents=True, exist_ok=True)
        if "sqlite3" in connection.settings_dict.get("ENGINE", ""):
            connection.ensure_connection()
            with sqlite3.connect(str(destination)) as backup_conn:
                connection.connection.backup(backup_conn)
        else:
            copy2(source_path, destination)
        return destination

    def _date(self, row):
        return datetime.strptime(row["date"], "%Y-%m-%d").date()

    def _d(self, value):
        if value is None:
            return None
        raw = str(value).replace(",", "").strip()
        if raw in ("", "-"):
            return None
        return Decimal(raw)

    def _desc(self, value):
        return (value or "")[:200]

    def _q8(self, value):
        return Decimal(value).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def _q4(self, value):
        return Decimal(value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    def _q2(self, value):
        return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

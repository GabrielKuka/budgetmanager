import sqlite3
from decimal import Decimal
from pathlib import Path
from shutil import copy2

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import Count, Sum
from django.utils import timezone

from Accounts.models import Account, CashBalance, Holding
from Transactions.models import (
    ExpenseDetail,
    IncomeDetail,
    SecurityTradeDetail,
    Transaction,
    TransferDetail,
)
from Users.models import User


MERGE_PLAN = [
    {
        "group": "Trading212",
        "target_id": 34,
        "target_name": "Trading212",
        "source_ids": [58, 43],
    },
    {
        "group": "Wise",
        "target_id": 5,
        "target_name": "Wise",
        "source_ids": [4, 26],
    },
    {
        "group": "Interactive Brokers",
        "target_id": 8,
        "target_name": "Interactive Brokers",
        "source_ids": [60],
    },
    {
        "group": "Hard Cash",
        "target_id": 10,
        "target_name": "Hard Cash",
        "source_ids": [37, 38, 39],
    },
    {
        "group": "UBB",
        "target_id": 11,
        "target_name": "UBB",
        "source_ids": [7],
    },
    {
        "group": "Raiffeisen",
        "target_id": 59,
        "target_name": "Raiffeisen",
        "source_ids": [],
    },
    {
        "group": "Revolut",
        "target_id": 27,
        "target_name": "Revolut",
        "source_ids": [28, 30, 31, 29],
    },
]

EXPECTED_TARGET_CURRENCIES = {
    34: {"EUR", "USD", "BGN"},  # Trading212
    5: {"EUR", "USD", "BGN"},  # Wise
    8: {"EUR", "USD"},  # Interactive Brokers
    10: {"BGN", "USD", "EUR", "ALL"},  # Hard Cash
    11: {"EUR", "BGN"},  # UBB
    59: {"EUR"},  # Raiffeisen
    27: {"EUR", "USD", "BGN"},  # Revolut
}


class Command(BaseCommand):
    help = (
        "Merge one user's legacy per-currency accounts into canonical multi-currency "
        "accounts while preserving transaction history."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-email",
            required=True,
            help="Email of the user to migrate (case-insensitive).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes. If omitted, command runs in dry-run mode.",
        )
        parser.add_argument(
            "--backup-path",
            default=None,
            help=(
                "Optional backup destination. If a directory is provided, a timestamped "
                "SQLite backup file is created there."
            ),
        )

    def handle(self, *args, **options):
        user_email = options["user_email"].strip()
        apply_changes = bool(options["apply"])
        backup_path = options.get("backup_path")

        user = User.objects.filter(email__iexact=user_email).first()
        if not user:
            raise CommandError(f"User not found: {user_email!r}")

        self._validate_plan_for_user(user)
        pre_snapshot = self._collect_snapshot(user)

        self.stdout.write(
            self.style.NOTICE(
                f"User: {user.email} (id={user.id}) | mode={'APPLY' if apply_changes else 'DRY-RUN'}"
            )
        )
        self._print_plan()
        self._print_snapshot("Pre-check", pre_snapshot)

        if not apply_changes:
            self.stdout.write(
                self.style.SUCCESS("Dry-run complete. No data changed.")
            )
            return

        if backup_path:
            backup_file = self._create_db_backup(backup_path)
            self.stdout.write(
                self.style.SUCCESS(f"Database backup created: {backup_file}")
            )

        with transaction.atomic():
            source_to_target, preserved_source_balances = self._execute_merge(
                user
            )
            self._recompute_transaction_account_pointers(user)
            self._rewrite_legacy_table_account_ids(user, source_to_target)
            self._normalize_account_legacy_fields(user)

            post_snapshot = self._collect_snapshot(user)
            self._assert_invariants(
                pre_snapshot,
                post_snapshot,
                source_to_target,
                preserved_source_balances,
                user,
            )

        self._print_snapshot("Post-check", post_snapshot)
        self.stdout.write(
            self.style.SUCCESS("Account merge migration applied successfully.")
        )

    def _print_plan(self):
        self.stdout.write(self.style.NOTICE("Merge groups:"))
        for row in MERGE_PLAN:
            sources = ", ".join(str(sid) for sid in row["source_ids"]) or "-"
            self.stdout.write(
                f"  - {row['group']}: target={row['target_id']} name={row['target_name']!r}, "
                f"sources=[{sources}]"
            )

    def _validate_plan_for_user(self, user):
        seen_ids = set()

        for row in MERGE_PLAN:
            target_id = row["target_id"]
            if target_id in seen_ids:
                raise CommandError(
                    f"Duplicate account id in merge plan: {target_id}"
                )
            seen_ids.add(target_id)

            target = Account.objects.filter(pk=target_id, user=user).first()
            if not target:
                raise CommandError(
                    f"Target account {target_id} ({row['group']}) not found for user {user.email}."
                )

            for source_id in row["source_ids"]:
                if source_id in seen_ids:
                    raise CommandError(
                        f"Duplicate account id in merge plan: {source_id}"
                    )
                seen_ids.add(source_id)

                source = Account.objects.filter(
                    pk=source_id, user=user
                ).first()
                if not source:
                    raise CommandError(
                        f"Source account {source_id} ({row['group']}) not found for user {user.email}."
                    )
                if source_id == target_id:
                    raise CommandError(
                        f"Invalid plan: source {source_id} equals target {target_id}."
                    )

    def _collect_snapshot(self, user):
        table_names = set(connection.introspection.table_names())
        type_counts = {
            row["transaction_type"]: row["count"]
            for row in (
                Transaction.objects.filter(user=user)
                .values("transaction_type")
                .annotate(count=Count("id"))
            )
        }

        missing_detail = {
            "income": Transaction.objects.filter(
                user=user,
                transaction_type="income",
                income_detail__isnull=True,
            ).count(),
            "expense": Transaction.objects.filter(
                user=user,
                transaction_type="expense",
                expense_detail__isnull=True,
            ).count(),
            "transfer": Transaction.objects.filter(
                user=user,
                transaction_type="transfer",
                transfer_detail__isnull=True,
            ).count(),
            "buy": Transaction.objects.filter(
                user=user,
                transaction_type="buy",
                security_trade_detail__isnull=True,
            ).count(),
            "sell": Transaction.objects.filter(
                user=user,
                transaction_type="sell",
                security_trade_detail__isnull=True,
            ).count(),
        }

        duplicate_pairs = (
            CashBalance.objects.filter(account__user=user)
            .values("account_id", "currency_id")
            .annotate(cnt=Count("id"))
            .filter(cnt__gt=1)
            .count()
        )

        group_totals = {}
        target_currency_sets = {}
        for row in MERGE_PLAN:
            scoped_ids = [row["target_id"], *row["source_ids"]]
            total = CashBalance.objects.filter(
                account__user=user, account_id__in=scoped_ids
            ).aggregate(total=Sum("balance")).get("total") or Decimal("0")
            group_totals[row["group"]] = str(total)

            target_currency_sets[row["target_id"]] = set(
                CashBalance.objects.filter(
                    account__user=user,
                    account_id=row["target_id"],
                )
                .values_list("currency__code", flat=True)
                .order_by("currency__code")
            )

        legacy_row_counts = {}
        for table in (
            "Transactions_income",
            "Transactions_expense",
            "Transactions_transfer",
        ):
            if table in table_names:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"SELECT COUNT(*) FROM {table} WHERE user_id = %s",
                        [user.id],
                    )
                    legacy_row_counts[table] = int(cursor.fetchone()[0])
            else:
                legacy_row_counts[table] = None

        return {
            "txn_total": Transaction.objects.filter(user=user).count(),
            "txn_by_type": {
                "income": type_counts.get("income", 0),
                "expense": type_counts.get("expense", 0),
                "transfer": type_counts.get("transfer", 0),
                "buy": type_counts.get("buy", 0),
                "sell": type_counts.get("sell", 0),
            },
            "missing_detail": missing_detail,
            "group_totals": group_totals,
            "duplicate_pairs": duplicate_pairs,
            "legacy_row_counts": legacy_row_counts,
            "target_currency_sets": target_currency_sets,
        }

    def _print_snapshot(self, label, snapshot):
        self.stdout.write(self.style.NOTICE(f"{label}:"))
        self.stdout.write(
            f"  Transactions total={snapshot['txn_total']} "
            f"(income={snapshot['txn_by_type']['income']}, "
            f"expense={snapshot['txn_by_type']['expense']}, "
            f"transfer={snapshot['txn_by_type']['transfer']}, "
            f"buy={snapshot['txn_by_type']['buy']}, "
            f"sell={snapshot['txn_by_type']['sell']})"
        )
        self.stdout.write(
            "  Missing details: "
            + ", ".join(
                f"{k}={v}" for k, v in snapshot["missing_detail"].items()
            )
        )
        self.stdout.write(
            f"  Duplicate (account,currency) cash-balance pairs: {snapshot['duplicate_pairs']}"
        )
        self.stdout.write(
            "  Legacy rows: "
            + ", ".join(
                f"{table}={count}"
                for table, count in snapshot["legacy_row_counts"].items()
            )
        )
        self.stdout.write(
            "  Group balance totals: "
            + ", ".join(
                f"{group}={total}"
                for group, total in snapshot["group_totals"].items()
            )
        )

    def _create_db_backup(self, backup_path):
        db_name = connection.settings_dict.get("NAME")
        if not db_name:
            raise CommandError(
                "Could not determine default DB name from Django connection settings."
            )

        source_path = Path(str(db_name))
        if not source_path.is_absolute():
            source_path = (Path.cwd() / source_path).resolve()

        destination_input = Path(str(backup_path))
        destination = destination_input
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")

        if destination_input.exists():
            if destination_input.is_dir():
                destination = (
                    destination_input
                    / f"{source_path.name}.backup_{timestamp}"
                )
        else:
            is_directory_like = (
                str(backup_path).endswith("/")
                or destination_input.suffix == ""
            )
            if is_directory_like:
                destination_input.mkdir(parents=True, exist_ok=True)
                destination = (
                    destination_input
                    / f"{source_path.name}.backup_{timestamp}"
                )

        destination.parent.mkdir(parents=True, exist_ok=True)

        if "sqlite3" in connection.settings_dict.get("ENGINE", ""):
            connection.ensure_connection()
            if not source_path.exists():
                raise CommandError(f"SQLite DB file not found: {source_path}")
            with sqlite3.connect(str(destination)) as backup_conn:
                connection.connection.backup(backup_conn)
        else:
            if not source_path.exists():
                raise CommandError(
                    f"DB file not found for backup: {source_path}"
                )
            copy2(source_path, destination)

        return destination

    def _execute_merge(self, user):
        source_to_target = {}
        preserved_source_balances = {}
        for row in MERGE_PLAN:
            target = Account.objects.select_for_update().get(
                pk=row["target_id"], user=user
            )
            changed_target_fields = []
            if target.name != row["target_name"]:
                target.name = row["target_name"]
                changed_target_fields.append("name")
            if target.deleted:
                target.deleted = False
                changed_target_fields.append("deleted")
            if changed_target_fields:
                target.save(
                    update_fields=[*changed_target_fields, "updated_on"]
                )

            for source_id in row["source_ids"]:
                source = Account.objects.select_for_update().get(
                    pk=source_id, user=user
                )
                source_to_target[source.id] = target.id

                preserved = self._move_cash_balances(source, target)
                if preserved:
                    preserved_source_balances[source.id] = preserved
                self._move_holdings(source, target)
                self._mark_source_as_merged(source, row["target_name"])

        return source_to_target, preserved_source_balances

    def _move_cash_balances(self, source, target):
        preserved_source_balances = []
        balances = list(
            CashBalance.objects.select_for_update()
            .select_related("currency")
            .filter(account=source)
            .order_by("id")
        )
        for source_balance in balances:
            target_balance = (
                CashBalance.objects.select_for_update()
                .filter(account=target, currency=source_balance.currency)
                .first()
            )
            if not target_balance:
                source_balance.account = target
                source_balance.save(update_fields=["account", "updated_on"])
                continue

            from_conflicts = TransferDetail.objects.filter(
                from_cash_balance_id=source_balance.id,
                to_cash_balance_id=target_balance.id,
            ).count()
            to_conflicts = TransferDetail.objects.filter(
                from_cash_balance_id=target_balance.id,
                to_cash_balance_id=source_balance.id,
            ).count()
            if from_conflicts or to_conflicts:
                if (source_balance.balance or Decimal("0")) != Decimal("0"):
                    raise CommandError(
                        "Cannot preserve duplicate-currency source balance with non-zero amount. "
                        "Please resolve this manually before merge."
                    )

                # Keep this zero-balance row on the source account so historical transfer
                # details remain valid (avoids collapsing into from == to on same row).
                preserved_source_balances.append(source_balance.id)
                continue

            IncomeDetail.objects.filter(
                to_cash_balance_id=source_balance.id
            ).update(to_cash_balance_id=target_balance.id)
            ExpenseDetail.objects.filter(
                from_cash_balance_id=source_balance.id
            ).update(from_cash_balance_id=target_balance.id)
            TransferDetail.objects.filter(
                from_cash_balance_id=source_balance.id
            ).update(from_cash_balance_id=target_balance.id)
            TransferDetail.objects.filter(
                to_cash_balance_id=source_balance.id
            ).update(to_cash_balance_id=target_balance.id)
            SecurityTradeDetail.objects.filter(
                cash_balance_id=source_balance.id
            ).update(cash_balance_id=target_balance.id)

            target_balance.balance = (
                target_balance.balance or Decimal("0")
            ) + (source_balance.balance or Decimal("0"))
            target_balance.save(update_fields=["balance", "updated_on"])
            source_balance.delete()

        return preserved_source_balances

    def _move_holdings(self, source, target):
        holdings = list(
            Holding.objects.select_for_update()
            .select_related("security")
            .filter(account=source)
            .order_by("id")
        )
        for source_holding in holdings:
            target_holding = (
                Holding.objects.select_for_update()
                .filter(account=target, security=source_holding.security)
                .first()
            )
            if not target_holding:
                source_holding.account = target
                source_holding.save(update_fields=["account", "updated_on"])
                continue

            SecurityTradeDetail.objects.filter(
                holding_id=source_holding.id
            ).update(holding_id=target_holding.id)

            source_qty = source_holding.quantity or Decimal("0")
            source_avg = source_holding.average_cost or Decimal("0")
            target_qty = target_holding.quantity or Decimal("0")
            target_avg = target_holding.average_cost or Decimal("0")

            merged_qty = source_qty + target_qty
            if merged_qty > 0:
                merged_avg = (
                    (source_qty * source_avg) + (target_qty * target_avg)
                ) / merged_qty
            else:
                merged_avg = Decimal("0")

            target_holding.quantity = merged_qty
            target_holding.average_cost = merged_avg
            target_holding.save(
                update_fields=["quantity", "average_cost", "updated_on"]
            )
            source_holding.delete()

    def _mark_source_as_merged(self, source, target_name):
        prefix = f"[MERGED->{target_name}] "
        current_name = source.name or ""
        if not current_name.startswith(prefix):
            source.name = f"{prefix}{current_name}"
        source.deleted = True
        source.amount = 0.0
        source.save(update_fields=["name", "deleted", "amount", "updated_on"])

    def _recompute_transaction_account_pointers(self, user):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE Transactions_transaction
                SET from_account_id = NULL,
                    to_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_incomedetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.to_cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    )
                WHERE user_id = %s AND transaction_type = 'income';
                """,
                [user.id],
            )

            cursor.execute(
                """
                UPDATE Transactions_transaction
                SET from_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_expensedetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.from_cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    ),
                    to_account_id = NULL
                WHERE user_id = %s AND transaction_type = 'expense';
                """,
                [user.id],
            )

            cursor.execute(
                """
                UPDATE Transactions_transaction
                SET from_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_transferdetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.from_cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    ),
                    to_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_transferdetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.to_cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    )
                WHERE user_id = %s AND transaction_type = 'transfer';
                """,
                [user.id],
            )

            cursor.execute(
                """
                UPDATE Transactions_transaction
                SET from_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_securitytradedetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    ),
                    to_account_id = NULL
                WHERE user_id = %s AND transaction_type = 'buy';
                """,
                [user.id],
            )

            cursor.execute(
                """
                UPDATE Transactions_transaction
                SET from_account_id = NULL,
                    to_account_id = (
                        SELECT cb.account_id
                        FROM Transactions_securitytradedetail d
                        JOIN Accounts_cashbalance cb ON cb.id = d.cash_balance_id
                        WHERE d.transaction_id = Transactions_transaction.id
                    )
                WHERE user_id = %s AND transaction_type = 'sell';
                """,
                [user.id],
            )

    def _rewrite_legacy_table_account_ids(self, user, source_to_target):
        if not source_to_target:
            return

        table_names = set(connection.introspection.table_names())
        source_ids = sorted(source_to_target.keys())
        source_placeholders = ", ".join(["%s"] * len(source_ids))
        case_sql = self._build_case_sql("account_id", source_to_target)
        case_from_sql = self._build_case_sql(
            "from_account_id", source_to_target
        )
        case_to_sql = self._build_case_sql("to_account_id", source_to_target)

        case_params = self._case_params(source_to_target)

        with connection.cursor() as cursor:
            if "Transactions_transaction" in table_names:
                cursor.execute(
                    f"""
                    UPDATE Transactions_transaction
                    SET from_account_id = {case_from_sql},
                        to_account_id = {case_to_sql}
                    WHERE user_id = %s
                      AND (
                          from_account_id IN ({source_placeholders})
                          OR to_account_id IN ({source_placeholders})
                      );
                    """,
                    [
                        *case_params,
                        *case_params,
                        user.id,
                        *source_ids,
                        *source_ids,
                    ],
                )

            if "Transactions_income" in table_names:
                cursor.execute(
                    f"""
                    UPDATE Transactions_income
                    SET account_id = {case_sql}
                    WHERE user_id = %s
                      AND account_id IN ({source_placeholders});
                    """,
                    [*case_params, user.id, *source_ids],
                )

            if "Transactions_expense" in table_names:
                cursor.execute(
                    f"""
                    UPDATE Transactions_expense
                    SET account_id = {case_sql}
                    WHERE user_id = %s
                      AND account_id IN ({source_placeholders});
                    """,
                    [*case_params, user.id, *source_ids],
                )

            if "Transactions_transfer" in table_names:
                cursor.execute(
                    f"""
                    UPDATE Transactions_transfer
                    SET from_account_id = {case_from_sql},
                        to_account_id = {case_to_sql}
                    WHERE user_id = %s
                      AND (
                          from_account_id IN ({source_placeholders})
                          OR to_account_id IN ({source_placeholders})
                      );
                    """,
                    [
                        *case_params,
                        *case_params,
                        user.id,
                        *source_ids,
                        *source_ids,
                    ],
                )

    def _build_case_sql(self, column_name, source_to_target):
        parts = [f"WHEN %s THEN %s" for _ in source_to_target]
        return f"CASE {column_name} {' '.join(parts)} ELSE {column_name} END"

    def _case_params(self, source_to_target):
        params = []
        for source_id in sorted(source_to_target.keys()):
            params.extend([source_id, source_to_target[source_id]])
        return params

    def _normalize_account_legacy_fields(self, user):
        accounts = Account.objects.filter(user=user).prefetch_related(
            "cash_balances__currency"
        )
        for account in accounts:
            balances = sorted(
                account.cash_balances.all(), key=lambda row: row.id
            )
            if balances:
                eur = next(
                    (row for row in balances if row.currency.code == "EUR"),
                    None,
                )
                primary = eur or balances[0]
                target_amount = float(primary.balance or Decimal("0"))
                target_currency = primary.currency.code
            else:
                target_amount = 0.0
                target_currency = account.currency or "EUR"

            changed_fields = []
            if float(account.amount or 0.0) != target_amount:
                account.amount = target_amount
                changed_fields.append("amount")
            if account.currency != target_currency:
                account.currency = target_currency
                changed_fields.append("currency")

            if changed_fields:
                account.save(update_fields=[*changed_fields, "updated_on"])

    def _assert_invariants(
        self, pre, post, source_to_target, preserved_source_balances, user
    ):
        if pre["txn_total"] != post["txn_total"]:
            raise CommandError(
                f"Transaction total changed: {pre['txn_total']} -> {post['txn_total']}"
            )

        for key in ("income", "expense", "transfer", "buy", "sell"):
            if pre["txn_by_type"][key] != post["txn_by_type"][key]:
                raise CommandError(
                    f"Transaction count changed for {key}: "
                    f"{pre['txn_by_type'][key]} -> {post['txn_by_type'][key]}"
                )

        for key in ("income", "expense", "transfer", "buy", "sell"):
            if post["missing_detail"][key] != pre["missing_detail"][key]:
                raise CommandError(
                    f"Missing detail count changed for {key}: "
                    f"{pre['missing_detail'][key]} -> {post['missing_detail'][key]}"
                )

        for group_name, pre_total in pre["group_totals"].items():
            post_total = post["group_totals"].get(group_name)
            if pre_total != post_total:
                raise CommandError(
                    f"Group balance total changed for {group_name}: {pre_total} -> {post_total}"
                )

        for table, pre_count in pre["legacy_row_counts"].items():
            post_count = post["legacy_row_counts"].get(table)
            if pre_count != post_count:
                raise CommandError(
                    f"Legacy row count changed for {table}: {pre_count} -> {post_count}"
                )

        if post["duplicate_pairs"] != 0:
            raise CommandError(
                f"Found duplicate (account,currency) cash-balance pairs after merge: {post['duplicate_pairs']}"
            )

        for (
            target_id,
            expected_currencies,
        ) in EXPECTED_TARGET_CURRENCIES.items():
            current = post["target_currency_sets"].get(target_id, set())
            if current != expected_currencies:
                target = Account.objects.filter(
                    pk=target_id, user=user
                ).first()
                raise CommandError(
                    f"Target account {target_id} ({target.name if target else 'unknown'}) "
                    f"currencies mismatch: expected {sorted(expected_currencies)}, got {sorted(current)}"
                )

        for source_id, target_id in source_to_target.items():
            source = Account.objects.filter(pk=source_id, user=user).first()
            if not source:
                raise CommandError(
                    f"Source account disappeared unexpectedly: {source_id}"
                )
            if not source.deleted:
                raise CommandError(
                    f"Source account is not soft-deleted after merge: {source_id}"
                )
            source_balance_qs = CashBalance.objects.filter(
                account_id=source_id
            )
            source_balance_count = source_balance_qs.count()
            source_holding_count = Holding.objects.filter(
                account_id=source_id
            ).count()
            preserved_ids = set(preserved_source_balances.get(source_id, []))

            if source_holding_count != 0:
                raise CommandError(
                    f"Source account {source_id} still has holdings after merge "
                    f"(holdings={source_holding_count})."
                )

            if source_balance_count != 0:
                current_ids = set(
                    source_balance_qs.values_list("id", flat=True)
                )
                if current_ids != preserved_ids:
                    raise CommandError(
                        f"Source account {source_id} has unexpected remaining cash balances. "
                        f"expected={sorted(preserved_ids)}, got={sorted(current_ids)}"
                    )

                non_zero_preserved = source_balance_qs.exclude(
                    balance=Decimal("0")
                ).count()
                if non_zero_preserved:
                    raise CommandError(
                        f"Source account {source_id} has non-zero preserved cash balances, "
                        "which is not allowed."
                    )
            if source.amount not in (0, 0.0):
                raise CommandError(
                    f"Source account {source_id} amount expected 0, got {source.amount}."
                )

            if target_id == source_id:
                raise CommandError(
                    f"Invalid mapping where source equals target: {source_id}"
                )

import csv
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from shutil import copy2

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import Count
from django.utils import timezone

from Accounts.models import Account, CashBalance, Holding, Security
from Transactions.models import (
    ExpenseDetail,
    IncomeDetail,
    SecurityTradeDetail,
    Transaction,
)
from Users.models import User
from tags.models import Tag


IBKR_IMPORT_TAG = "ibkr-csv-import"
IBKR_IMPORT_PREFIX = "[IBKR CSV IMPORT]"
IBKR_RECON_PREFIX = "[IBKR CSV IMPORT BALANCE RECONCILIATION]"
SYMBOL_NORMALIZATION = {"CSPX": "SXR8"}


@dataclass
class ParsedTrade:
    date: datetime.date
    tx_type: str  # buy | sell
    symbol: str
    security_id: int
    cash_balance_id: int
    quantity: Decimal
    price_per_unit: Decimal
    total_value: Decimal
    description: str


class Command(BaseCommand):
    help = (
        "Backfill IBKR Buy/Sell trades from CSV into Transaction + SecurityTradeDetail "
        "for one user/account, replace old manual VTI sale income, rebuild holdings, and "
        "optionally reconcile cash balances."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-email",
            required=True,
            help="User email (case-insensitive), e.g. gabrie.kuka@gmail.com",
        )
        parser.add_argument(
            "--csv-path",
            default="../budgetdb/transactions.csv",
            help="Path to IBKR CSV export.",
        )
        parser.add_argument(
            "--ibkr-account-code",
            default="U***61755",
            help="IBKR account code inside CSV Account column.",
        )
        parser.add_argument(
            "--ibkr-account-id",
            type=int,
            default=8,
            help="Target Account.id for Interactive Brokers.",
        )
        parser.add_argument(
            "--usd-cash-balance-id",
            type=int,
            default=5,
            help="Target USD CashBalance.id for IBKR account.",
        )
        parser.add_argument(
            "--eur-cash-balance-id",
            type=int,
            default=28,
            help="Target EUR CashBalance.id for IBKR account.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes. Omit for dry-run.",
        )
        parser.add_argument(
            "--backup-path",
            default=None,
            help="Optional DB backup destination file or directory.",
        )
        parser.add_argument(
            "--preserve-cash-balances",
            action="store_true",
            help=(
                "If provided, add reconciliation income/expense entries so ending cash "
                "balances remain equal to pre-import values."
            ),
        )

    def handle(self, *args, **options):
        user_email = options["user_email"].strip()
        csv_path = Path(options["csv_path"]).expanduser()
        if not csv_path.is_absolute():
            csv_path = (Path.cwd() / csv_path).resolve()

        apply_changes = bool(options["apply"])
        backup_path = options.get("backup_path")
        preserve_cash_balances = bool(options.get("preserve_cash_balances"))
        ibkr_account_code = options["ibkr_account_code"].strip()
        ibkr_account_id = int(options["ibkr_account_id"])
        usd_cb_id = int(options["usd_cash_balance_id"])
        eur_cb_id = int(options["eur_cash_balance_id"])

        if not csv_path.exists():
            raise CommandError(f"CSV file not found: {csv_path}")

        user = User.objects.filter(email__iexact=user_email).first()
        if not user:
            raise CommandError(f"User not found: {user_email}")

        account = Account.objects.filter(id=ibkr_account_id, user=user).first()
        if not account:
            raise CommandError(
                f"IBKR account id={ibkr_account_id} not found for user {user.email}."
            )

        cb_usd = (
            CashBalance.objects.select_related("currency", "account")
            .filter(id=usd_cb_id, account=account)
            .first()
        )
        cb_eur = (
            CashBalance.objects.select_related("currency", "account")
            .filter(id=eur_cb_id, account=account)
            .first()
        )
        if not cb_usd or cb_usd.currency.code != "USD":
            raise CommandError(
                f"USD cash balance mismatch: id={usd_cb_id} must be USD on account {account.id}."
            )
        if not cb_eur or cb_eur.currency.code != "EUR":
            raise CommandError(
                f"EUR cash balance mismatch: id={eur_cb_id} must be EUR on account {account.id}."
            )

        pre_snapshot = self._snapshot(user, account, cb_usd, cb_eur)
        parsed_trades = self._parse_csv(
            csv_path=csv_path,
            ibkr_account_code=ibkr_account_code,
            cb_usd_id=cb_usd.id,
            cb_eur_id=cb_eur.id,
        )
        imported_symbols = sorted({row.symbol for row in parsed_trades})

        self.stdout.write(
            self.style.NOTICE(
                f"user={user.email} id={user.id} account={account.id} "
                f"mode={'APPLY' if apply_changes else 'DRY-RUN'} "
                f"preserve_cash_balances={preserve_cash_balances}"
            )
        )
        self.stdout.write(
            self.style.NOTICE(
                f"csv={csv_path} account_code={ibkr_account_code}"
            )
        )
        self.stdout.write(
            f"parsed trades={len(parsed_trades)} symbols={', '.join(imported_symbols)}"
        )
        self.stdout.write(
            f"pre cash USD(cb:{cb_usd.id})={pre_snapshot['cash']['USD']} | "
            f"EUR(cb:{cb_eur.id})={pre_snapshot['cash']['EUR']}"
        )
        self.stdout.write(
            "pre tx count="
            f"{pre_snapshot['tx_total']} "
            f"(income={pre_snapshot['tx_by_type']['income']}, "
            f"expense={pre_snapshot['tx_by_type']['expense']}, "
            f"transfer={pre_snapshot['tx_by_type']['transfer']}, "
            f"buy={pre_snapshot['tx_by_type']['buy']}, "
            f"sell={pre_snapshot['tx_by_type']['sell']})"
        )

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
            import_tag, _ = Tag.objects.get_or_create(name=IBKR_IMPORT_TAG)

            # Idempotent reruns: reverse/delete previously imported rows first.
            old_import_qs = (
                Transaction.objects.filter(user=user, tags=import_tag)
                .select_related(
                    "income_detail",
                    "expense_detail",
                    "transfer_detail",
                    "security_trade_detail",
                )
                .order_by("-id")
            )
            old_count = old_import_qs.count()
            if old_count:
                for txn in old_import_qs:
                    self._reverse_and_delete_transaction(txn)
                self.stdout.write(
                    self.style.WARNING(
                        f"Removed previous import footprint: {old_count} tagged transactions."
                    )
                )

            deleted_manual = self._delete_manual_vti_income(
                user=user, account=account
            )
            self.stdout.write(
                self.style.NOTICE(
                    f"deleted manual VTI income tx rows={deleted_manual['transaction_rows']} "
                    f"legacy income rows={deleted_manual['legacy_income_rows']}"
                )
            )

            inserted_tx_count = 0
            for row in parsed_trades:
                txn = Transaction.objects.create(
                    user=user,
                    transaction_type=row.tx_type,
                    date=row.date,
                    description=self._fit_description(
                        f"{IBKR_IMPORT_PREFIX} {row.description}",
                        200,
                    ),
                    amount=self._q4(row.total_value),
                    from_account=account if row.tx_type == "buy" else None,
                    to_account=account if row.tx_type == "sell" else None,
                )
                txn.tags.add(import_tag)

                SecurityTradeDetail.objects.create(
                    transaction=txn,
                    security_id=row.security_id,
                    cash_balance_id=row.cash_balance_id,
                    quantity=self._q8(row.quantity),
                    price_per_unit=self._q8(row.price_per_unit),
                )

                cb = cb_usd if row.cash_balance_id == cb_usd.id else cb_eur
                if row.tx_type == "buy":
                    cb.balance = (cb.balance or Decimal("0")) - row.total_value
                else:
                    cb.balance = (cb.balance or Decimal("0")) + row.total_value

                inserted_tx_count += 1

            cb_usd.save(update_fields=["balance", "updated_on"])
            cb_eur.save(update_fields=["balance", "updated_on"])

            rebuilt = self._rebuild_holdings(
                user=user,
                account=account,
                symbols=imported_symbols,
            )
            self.stdout.write(
                self.style.NOTICE(
                    f"holdings rebuilt for {len(imported_symbols)} symbols "
                    f"(updated={rebuilt['updated']}, removed={rebuilt['removed']})"
                )
            )

            reconciled = 0
            if preserve_cash_balances:
                reconciled = self._reconcile_cash(
                    user=user,
                    account=account,
                    cb_usd=cb_usd,
                    cb_eur=cb_eur,
                    pre_usd=pre_snapshot["cash"]["USD"],
                    pre_eur=pre_snapshot["cash"]["EUR"],
                    import_tag=import_tag,
                )

            self._assert_post_conditions(
                user=user,
                account=account,
                cb_usd=cb_usd,
                cb_eur=cb_eur,
                pre_snapshot=pre_snapshot,
                inserted_tx_count=inserted_tx_count,
                imported_symbols=imported_symbols,
                parsed_trades=parsed_trades,
                preserve_cash_balances=preserve_cash_balances,
            )

        self.stdout.write(
            self.style.SUCCESS(
                "IBKR backfill applied: "
                f"inserted_trades={inserted_tx_count}, "
                f"reconciliation_entries={reconciled}"
            )
        )

    def _parse_csv(self, csv_path, ibkr_account_code, cb_usd_id, cb_eur_id):
        rows = []
        headers = None

        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.reader(fh)
            for raw in reader:
                if not raw:
                    continue
                if (
                    len(raw) >= 2
                    and raw[0] == "Transaction History"
                    and raw[1] == "Header"
                ):
                    headers = [col.strip() for col in raw[2:]]
                    continue
                if not (
                    len(raw) >= 2
                    and raw[0] == "Transaction History"
                    and raw[1] == "Data"
                ):
                    continue
                if not headers:
                    raise CommandError(
                        "Could not locate Transaction History header in CSV."
                    )

                payload = {}
                for idx, name in enumerate(headers):
                    payload[name.strip().lower()] = (
                        raw[idx + 2].strip() if idx + 2 < len(raw) else ""
                    )

                if payload.get("account") != ibkr_account_code:
                    continue

                tx_type_raw = payload.get("transaction type", "")
                if tx_type_raw not in {"Buy", "Sell"}:
                    continue

                symbol_raw = payload.get("symbol", "").upper()
                if not symbol_raw:
                    continue
                symbol = SYMBOL_NORMALIZATION.get(symbol_raw, symbol_raw)

                security = Security.objects.filter(ticker=symbol).first()
                if not security:
                    raise CommandError(
                        f"Security not found for ticker from CSV: {symbol}"
                    )

                quantity_raw = self._d(payload.get("quantity"))
                if quantity_raw is None or quantity_raw == 0:
                    raise CommandError(
                        f"Invalid quantity in CSV for {symbol}: {payload.get('quantity')!r}"
                    )
                quantity = abs(quantity_raw)

                price_currency = payload.get("price currency", "").upper()
                if price_currency not in {"USD", "EUR"}:
                    raise CommandError(
                        f"Unsupported price currency for {symbol} at {payload.get('date')}: {price_currency!r}"
                    )
                cash_balance_id = (
                    cb_usd_id if price_currency == "USD" else cb_eur_id
                )

                trade_total = self._compute_trade_total(
                    tx_type=tx_type_raw.lower(),
                    quantity=quantity,
                    price=self._d(payload.get("price")),
                    price_currency=price_currency,
                    gross_amount=self._d(payload.get("gross amount")),
                    net_amount=self._d(payload.get("net amount")),
                    commission=self._d(payload.get("commission")),
                    row=payload,
                )

                if quantity <= 0:
                    raise CommandError(
                        f"Non-positive quantity after normalization for {symbol}"
                    )
                if trade_total <= 0:
                    raise CommandError(
                        f"Non-positive trade total for {symbol} on {payload.get('date')}"
                    )

                price_per_unit = trade_total / quantity
                trade_date = datetime.strptime(
                    payload["date"], "%Y-%m-%d"
                ).date()

                rows.append(
                    ParsedTrade(
                        date=trade_date,
                        tx_type=tx_type_raw.lower(),
                        symbol=symbol,
                        security_id=security.id,
                        cash_balance_id=cash_balance_id,
                        quantity=quantity,
                        price_per_unit=price_per_unit,
                        total_value=trade_total,
                        description=payload.get("description", symbol),
                    )
                )

        if not rows:
            raise CommandError(
                "No Buy/Sell rows matched the provided filters."
            )

        rows.sort(key=lambda r: (r.date, r.symbol, r.tx_type))
        return rows

    def _compute_trade_total(
        self,
        tx_type,
        quantity,
        price,
        price_currency,
        gross_amount,
        net_amount,
        commission,
        row,
    ):
        if price_currency == "EUR":
            if net_amount is None:
                raise CommandError(f"EUR row missing net amount: {row}")
            return abs(net_amount)

        # USD rows:
        if price is None:
            raise CommandError(f"USD row missing price: {row}")
        notional_usd = abs(quantity * price)
        if notional_usd <= 0:
            raise CommandError(f"USD row notional invalid: {row}")
        if gross_amount is None:
            raise CommandError(f"USD row missing gross amount: {row}")

        fx_eur_per_usd = abs(gross_amount) / notional_usd
        if fx_eur_per_usd <= 0:
            raise CommandError(f"USD row invalid implied FX: {row}")

        commission_usd = Decimal("0")
        if commission is not None:
            commission_usd = abs(commission) / fx_eur_per_usd

        if tx_type == "buy":
            return notional_usd + commission_usd
        if tx_type == "sell":
            value = notional_usd - commission_usd
            if value <= 0:
                raise CommandError(
                    f"USD sell produced non-positive proceeds: {row}"
                )
            return value
        raise CommandError(f"Unsupported tx_type: {tx_type}")

    def _delete_manual_vti_income(self, user, account):
        tx_rows = 0
        legacy_rows = 0

        tx = (
            Transaction.objects.filter(
                id=629,
                user=user,
                transaction_type="income",
            )
            .select_related("income_detail")
            .first()
        )
        if tx:
            self._reverse_and_delete_transaction(tx)
            tx_rows += 1
        else:
            # fallback by business signature in case id changed
            fallback = (
                Transaction.objects.filter(
                    user=user,
                    transaction_type="income",
                    date="2024-05-20",
                    amount=Decimal("897.03"),
                    description__icontains="selling my VTI position",
                    to_account=account,
                )
                .select_related("income_detail")
                .first()
            )
            if fallback:
                self._reverse_and_delete_transaction(fallback)
                tx_rows += 1

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='Transactions_income'"
            )
            has_legacy_income = cursor.fetchone() is not None
            if has_legacy_income:
                ids_to_delete = [713]
                cursor.execute(
                    """
                    SELECT id
                    FROM Transactions_income
                    WHERE user_id = %s
                      AND account_id = %s
                      AND date = '2024-05-20'
                      AND ABS(amount - 897.03) < 0.000001
                      AND description LIKE '%%selling my VTI position%%'
                    """,
                    [user.id, account.id],
                )
                ids_to_delete.extend(row[0] for row in cursor.fetchall())
                ids_to_delete = sorted(set(ids_to_delete))

                if ids_to_delete:
                    placeholders = ", ".join(["%s"] * len(ids_to_delete))
                    cursor.execute(
                        f"DELETE FROM Transactions_income_tags WHERE income_id IN ({placeholders})",
                        ids_to_delete,
                    )
                    cursor.execute(
                        f"DELETE FROM Transactions_income WHERE id IN ({placeholders})",
                        ids_to_delete,
                    )
                    legacy_rows += int(cursor.rowcount or 0)

        return {"transaction_rows": tx_rows, "legacy_income_rows": legacy_rows}

    def _reverse_and_delete_transaction(self, txn):
        if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
            detail = txn.income_detail
            cb = CashBalance.objects.select_for_update().get(
                pk=detail.to_cash_balance_id
            )
            cb.balance = (cb.balance or Decimal("0")) - detail.amount
            cb.save(update_fields=["balance", "updated_on"])
        elif txn.transaction_type == "expense" and hasattr(
            txn, "expense_detail"
        ):
            detail = txn.expense_detail
            cb = CashBalance.objects.select_for_update().get(
                pk=detail.from_cash_balance_id
            )
            cb.balance = (cb.balance or Decimal("0")) + detail.amount
            cb.save(update_fields=["balance", "updated_on"])
        elif txn.transaction_type == "transfer" and hasattr(
            txn, "transfer_detail"
        ):
            detail = txn.transfer_detail
            src = CashBalance.objects.select_for_update().get(
                pk=detail.from_cash_balance_id
            )
            dst = CashBalance.objects.select_for_update().get(
                pk=detail.to_cash_balance_id
            )
            credited = detail.amount * detail.fx_rate
            src.balance = (src.balance or Decimal("0")) + detail.amount
            dst.balance = (dst.balance or Decimal("0")) - credited
            src.save(update_fields=["balance", "updated_on"])
            dst.save(update_fields=["balance", "updated_on"])
        elif txn.transaction_type == "buy" and hasattr(
            txn, "security_trade_detail"
        ):
            detail = txn.security_trade_detail
            cb = CashBalance.objects.select_for_update().get(
                pk=detail.cash_balance_id
            )
            cb.balance = (cb.balance or Decimal("0")) + detail.total_value
            cb.save(update_fields=["balance", "updated_on"])
        elif txn.transaction_type == "sell" and hasattr(
            txn, "security_trade_detail"
        ):
            detail = txn.security_trade_detail
            cb = CashBalance.objects.select_for_update().get(
                pk=detail.cash_balance_id
            )
            cb.balance = (cb.balance or Decimal("0")) - detail.total_value
            cb.save(update_fields=["balance", "updated_on"])

        txn.delete()

    def _rebuild_holdings(self, user, account, symbols):
        if not symbols:
            return {"updated": 0, "removed": 0}

        securities = list(Security.objects.filter(ticker__in=symbols))
        by_ticker = {s.ticker: s for s in securities}

        updated = 0
        removed = 0

        for ticker in symbols:
            security = by_ticker.get(ticker)
            if not security:
                raise CommandError(
                    f"Security missing while rebuilding holdings: {ticker}"
                )

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
            for trade in trades:
                t_type = trade.transaction.transaction_type
                if t_type == "buy":
                    old_total = qty * avg
                    buy_total = trade.quantity * trade.price_per_unit
                    qty = qty + trade.quantity
                    avg = (
                        (old_total + buy_total) / qty
                        if qty > 0
                        else Decimal("0")
                    )
                elif t_type == "sell":
                    if qty < trade.quantity:
                        # CSV period may start after the initial buys (pre-period inventory).
                        # Keep holding non-negative and treat excess as depletion of prior inventory.
                        qty = Decimal("0")
                        avg = Decimal("0")
                        continue
                    qty = qty - trade.quantity
                    if qty == 0:
                        avg = Decimal("0")

            existing = Holding.objects.filter(
                account=account, security=security
            ).first()
            if qty > 0:
                if existing:
                    existing.quantity = self._q8(qty)
                    existing.average_cost = self._q8(avg)
                    existing.save(
                        update_fields=[
                            "quantity",
                            "average_cost",
                            "updated_on",
                        ]
                    )
                    holding = existing
                else:
                    holding = Holding.objects.create(
                        account=account,
                        security=security,
                        quantity=self._q8(qty),
                        average_cost=self._q8(avg),
                    )
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
                if existing:
                    existing.delete()
                    removed += 1

        return {"updated": updated, "removed": removed}

    def _reconcile_cash(
        self, user, account, cb_usd, cb_eur, pre_usd, pre_eur, import_tag
    ):
        created = 0
        for cb, target in ((cb_usd, pre_usd), (cb_eur, pre_eur)):
            current = cb.balance or Decimal("0")
            delta = target - current
            if delta == 0:
                continue

            if delta > 0:
                txn = Transaction.objects.create(
                    user=user,
                    transaction_type="income",
                    date=timezone.now().date(),
                    description=self._fit_description(
                        f"{IBKR_RECON_PREFIX} {cb.currency.code}",
                        200,
                    ),
                    amount=self._q4(delta),
                    category=None,
                    from_account=None,
                    to_account=account,
                )
                IncomeDetail.objects.create(
                    transaction=txn,
                    to_cash_balance=cb,
                    amount=self._q4(delta),
                    category=None,
                )
                cb.balance = current + delta
            else:
                amount = abs(delta)
                txn = Transaction.objects.create(
                    user=user,
                    transaction_type="expense",
                    date=timezone.now().date(),
                    description=self._fit_description(
                        f"{IBKR_RECON_PREFIX} {cb.currency.code}",
                        200,
                    ),
                    amount=self._q4(amount),
                    category=None,
                    from_account=account,
                    to_account=None,
                )
                ExpenseDetail.objects.create(
                    transaction=txn,
                    from_cash_balance=cb,
                    amount=self._q4(amount),
                    category=None,
                )
                cb.balance = current - amount

            txn.tags.add(import_tag)
            cb.save(update_fields=["balance", "updated_on"])
            created += 1

        return created

    def _snapshot(self, user, account, cb_usd, cb_eur):
        type_counts = {
            row["transaction_type"]: row["count"]
            for row in (
                Transaction.objects.filter(user=user)
                .values("transaction_type")
                .annotate(count=Count("id"))
            )
        }
        holdings = {
            row.security.ticker: {
                "quantity": row.quantity,
                "average_cost": row.average_cost,
            }
            for row in Holding.objects.filter(account=account).select_related(
                "security"
            )
        }
        return {
            "cash": {
                "USD": cb_usd.balance or Decimal("0"),
                "EUR": cb_eur.balance or Decimal("0"),
            },
            "tx_total": Transaction.objects.filter(user=user).count(),
            "tx_by_type": {
                "income": type_counts.get("income", 0),
                "expense": type_counts.get("expense", 0),
                "transfer": type_counts.get("transfer", 0),
                "buy": type_counts.get("buy", 0),
                "sell": type_counts.get("sell", 0),
            },
            "holdings": holdings,
        }

    def _assert_post_conditions(
        self,
        user,
        account,
        cb_usd,
        cb_eur,
        pre_snapshot,
        inserted_tx_count,
        imported_symbols,
        parsed_trades,
        preserve_cash_balances,
    ):
        if inserted_tx_count <= 0:
            raise CommandError("No trade transactions inserted.")

        # Manual row must be gone.
        if Transaction.objects.filter(id=629, user=user).exists():
            raise CommandError(
                "Old manual income transaction id=629 still exists."
            )
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Transactions_income'"
            )
            if int(cursor.fetchone()[0]) > 0:
                cursor.execute(
                    "SELECT COUNT(*) FROM Transactions_income WHERE id = 713"
                )
                if int(cursor.fetchone()[0]) != 0:
                    raise CommandError(
                        "Legacy Transactions_income row id=713 still exists."
                    )

        # Exactly two VTI sells on 2024-05-20 from import set.
        vti_sells = SecurityTradeDetail.objects.filter(
            transaction__user=user,
            transaction__transaction_type="sell",
            transaction__date="2024-05-20",
            security__ticker="VTI",
            transaction__description__startswith=IBKR_IMPORT_PREFIX,
        ).count()
        if vti_sells != 2:
            raise CommandError(
                f"Expected 2 imported VTI sells on 2024-05-20, found {vti_sells}."
            )

        if not preserve_cash_balances:
            recon_rows = Transaction.objects.filter(
                user=user,
                description__startswith=IBKR_RECON_PREFIX,
            ).count()
            if recon_rows != 0:
                raise CommandError(
                    f"Reconciliation rows should be absent when preserve-cash is off; found {recon_rows}."
                )

        # Cash preservation.
        cb_usd.refresh_from_db(fields=["balance"])
        cb_eur.refresh_from_db(fields=["balance"])
        expected_usd = pre_snapshot["cash"]["USD"]
        expected_eur = pre_snapshot["cash"]["EUR"]
        if not preserve_cash_balances:
            usd_delta = Decimal("0")
            eur_delta = Decimal("0")
            for row in parsed_trades:
                sign = Decimal("-1") if row.tx_type == "buy" else Decimal("1")
                if row.cash_balance_id == cb_usd.id:
                    usd_delta += sign * row.total_value
                elif row.cash_balance_id == cb_eur.id:
                    eur_delta += sign * row.total_value
            expected_usd = expected_usd + self._q8(usd_delta)
            expected_eur = expected_eur + self._q8(eur_delta)

        actual_usd = cb_usd.balance or Decimal("0")
        actual_eur = cb_eur.balance or Decimal("0")
        if self._q4(actual_usd) != self._q4(expected_usd):
            raise CommandError(
                f"USD cash mismatch: {self._q4(actual_usd)} != {self._q4(expected_usd)}"
            )
        if self._q4(actual_eur) != self._q4(expected_eur):
            raise CommandError(
                f"EUR cash mismatch: {self._q4(actual_eur)} != {self._q4(expected_eur)}"
            )

        expected = {
            "CSH2": (Decimal("231.4975"), Decimal("25013.81"), "EUR"),
            "SPY": (Decimal("15.8252"), Decimal("8945.64"), "USD"),
            "SXR8": (Decimal("5.1817"), Decimal("3259.63"), "EUR"),
            "ERNX": (Decimal("473.6767"), Decimal("2621.60"), "EUR"),
            "VOO": (Decimal("1.5669"), Decimal("950.61"), "USD"),
            "MSFT": (Decimal("1"), Decimal("372.99"), "USD"),
            "XNAS": (Decimal("1.571"), Decimal("81.25"), "EUR"),
        }
        for ticker, (exp_qty, exp_cost_basis, _) in expected.items():
            holding = Holding.objects.filter(
                account=account, security__ticker=ticker
            ).first()
            if not holding:
                raise CommandError(
                    f"Holding missing for expected symbol {ticker}."
                )
            qty = holding.quantity or Decimal("0")
            cost_basis = (holding.quantity or Decimal("0")) * (
                holding.average_cost or Decimal("0")
            )
            if self._q4(qty) != self._q4(exp_qty):
                raise CommandError(
                    f"{ticker} quantity mismatch: {qty} != {exp_qty}"
                )
            if self._q2(cost_basis) != self._q2(exp_cost_basis):
                raise CommandError(
                    f"{ticker} cost basis mismatch: {self._q2(cost_basis)} != {self._q2(exp_cost_basis)}"
                )

        # Ensure CSV symbols exist as holdings or fully sold-out.
        holding_tickers = set(
            Holding.objects.filter(account=account).values_list(
                "security__ticker", flat=True
            )
        )
        imported_set = set(imported_symbols)
        if not imported_set.issuperset(
            holding_tickers.intersection(imported_set)
        ):
            raise CommandError(
                "Imported symbols / holding symbols invariant failed."
            )

    def _create_db_backup(self, backup_path):
        db_name = connection.settings_dict.get("NAME")
        if not db_name:
            raise CommandError(
                "Could not determine DB path from Django settings."
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
                raise CommandError(f"DB file not found: {source_path}")
            copy2(source_path, destination)

        return destination

    def _fit_description(self, value, max_len):
        text = (value or "").strip()
        return text[:max_len]

    def _d(self, value):
        if value is None:
            return None
        raw = str(value).strip()
        if raw in ("", "-"):
            return None
        return Decimal(raw)

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

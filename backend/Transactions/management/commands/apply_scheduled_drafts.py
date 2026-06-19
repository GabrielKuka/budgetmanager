from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.utils import timezone

from Accounts.models import CashBalance, Holding
from Transactions.models import Transaction


def _apply_cash_delta(cash_balance, delta):
    from django.db.models import F

    CashBalance.objects.filter(pk=cash_balance.pk).update(
        balance=F("balance") + delta
    )
    cash_balance.refresh_from_db(fields=["balance"])


def _update_holding_for_buy(holding, quantity, price_per_unit):
    from decimal import Decimal

    quantity = Decimal(str(quantity))
    price_per_unit = Decimal(str(price_per_unit))

    old_qty = Decimal(str(holding.quantity or "0"))
    old_avg = Decimal(str(holding.average_cost or "0"))
    old_total_cost = old_qty * old_avg
    purchase_total = quantity * price_per_unit

    new_qty = old_qty + quantity
    new_total_cost = old_total_cost + purchase_total
    new_avg = new_total_cost / new_qty if new_qty > 0 else Decimal("0")

    holding.quantity = new_qty
    holding.average_cost = new_avg
    holding.save(update_fields=["quantity", "average_cost", "updated_on"])


def _update_holding_for_sell(holding, quantity):
    from decimal import Decimal

    quantity = Decimal(str(quantity))
    old_qty = Decimal(str(holding.quantity or "0"))
    new_qty = old_qty - quantity

    if new_qty < 0:
        raise ValueError(
            f"Cannot sell {quantity}; holding has only {old_qty}."
        )

    holding.quantity = new_qty
    holding.save(update_fields=["quantity", "updated_on"])


class Command(BaseCommand):
    help = "Apply scheduled draft transactions whose scheduled_apply_at has passed."

    def handle(self, *args, **options):
        now = timezone.now()
        drafts = Transaction.objects.filter(
            is_draft=True,
            scheduled_apply_at__lte=now,
        ).select_related(
            "income_detail__to_cash_balance",
            "expense_detail__from_cash_balance",
            "transfer_detail__from_cash_balance",
            "transfer_detail__to_cash_balance",
            "security_trade_detail__holding",
            "security_trade_detail__cash_balance",
        )

        applied_count = 0
        error_count = 0

        for txn in drafts:
            try:
                with db_transaction.atomic():
                    tx_type = txn.transaction_type

                    if tx_type == "income":
                        detail = txn.income_detail
                        _apply_cash_delta(
                            detail.to_cash_balance, detail.amount
                        )

                    elif tx_type == "expense":
                        detail = txn.expense_detail
                        _apply_cash_delta(
                            detail.from_cash_balance, -detail.amount
                        )

                    elif tx_type == "transfer":
                        detail = txn.transfer_detail
                        credited_amount = detail.amount * detail.fx_rate
                        _apply_cash_delta(
                            detail.from_cash_balance, -detail.amount
                        )
                        _apply_cash_delta(
                            detail.to_cash_balance, credited_amount
                        )

                    elif tx_type == "buy":
                        detail = txn.security_trade_detail
                        total = detail.total_value
                        _apply_cash_delta(detail.cash_balance, -total)
                        if detail.holding_id:
                            holding = Holding.objects.select_for_update().get(
                                pk=detail.holding_id
                            )
                            _update_holding_for_buy(
                                holding, detail.quantity, detail.price_per_unit
                            )

                    elif tx_type == "sell":
                        detail = txn.security_trade_detail
                        total = detail.total_value
                        _apply_cash_delta(detail.cash_balance, total)
                        if detail.holding_id:
                            holding = Holding.objects.select_for_update().get(
                                pk=detail.holding_id
                            )
                            _update_holding_for_sell(holding, detail.quantity)

                    else:
                        self.stderr.write(
                            f"Skipping draft {txn.pk}: unknown type {tx_type}"
                        )
                        continue

                    txn.is_draft = False
                    txn.applied_at = timezone.now()
                    txn.scheduled_apply_at = None
                    txn.save(
                        update_fields=[
                            "is_draft",
                            "applied_at",
                            "scheduled_apply_at",
                        ]
                    )
                    applied_count += 1

            except Exception as exc:
                error_count += 1
                self.stderr.write(f"Error applying draft {txn.pk}: {exc}")

        self.stdout.write(f"Applied {applied_count} scheduled draft(s).")
        if error_count:
            self.stderr.write(f"{error_count} draft(s) failed.")

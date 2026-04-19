from django.contrib import admin

from .models import (
    ExpenseDetail,
    IncomeDetail,
    SecurityTradeDetail,
    Transaction,
    TransactionCategory,
    TransferDetail,
)


class IncomeDetailInline(admin.StackedInline):
    model = IncomeDetail
    extra = 0
    autocomplete_fields = ("to_cash_balance", "category")


class ExpenseDetailInline(admin.StackedInline):
    model = ExpenseDetail
    extra = 0
    autocomplete_fields = ("from_cash_balance", "category")


class TransferDetailInline(admin.StackedInline):
    model = TransferDetail
    extra = 0
    autocomplete_fields = ("from_cash_balance", "to_cash_balance")


class SecurityTradeDetailInline(admin.StackedInline):
    model = SecurityTradeDetail
    extra = 0
    autocomplete_fields = ("security", "holding", "cash_balance")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "transaction_type", "date", "created_on")
    list_filter = ("transaction_type", "date", "created_on")
    search_fields = (
        "id",
        "description",
        "user__email",
        "user__name",
    )
    readonly_fields = ("created_on",)
    autocomplete_fields = ("category", "from_account", "to_account")
    inlines = (
        IncomeDetailInline,
        ExpenseDetailInline,
        TransferDetailInline,
        SecurityTradeDetailInline,
    )


@admin.register(TransactionCategory)
class TransactionCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "category_type")
    list_filter = ("category_type",)
    search_fields = ("category",)


@admin.register(IncomeDetail)
class IncomeDetailAdmin(admin.ModelAdmin):
    list_display = ("transaction", "to_cash_balance", "amount", "category")
    list_filter = ("to_cash_balance__currency", "transaction__date")
    search_fields = ("transaction__id", "transaction__description")
    autocomplete_fields = ("transaction", "to_cash_balance", "category")


@admin.register(ExpenseDetail)
class ExpenseDetailAdmin(admin.ModelAdmin):
    list_display = ("transaction", "from_cash_balance", "amount", "category")
    list_filter = ("from_cash_balance__currency", "transaction__date")
    search_fields = ("transaction__id", "transaction__description")
    autocomplete_fields = ("transaction", "from_cash_balance", "category")


@admin.register(TransferDetail)
class TransferDetailAdmin(admin.ModelAdmin):
    list_display = (
        "transaction",
        "from_cash_balance",
        "to_cash_balance",
        "amount",
        "fx_rate",
    )
    list_filter = ("from_cash_balance__currency", "to_cash_balance__currency")
    search_fields = ("transaction__id", "transaction__description")
    autocomplete_fields = (
        "transaction",
        "from_cash_balance",
        "to_cash_balance",
    )


@admin.register(SecurityTradeDetail)
class SecurityTradeDetailAdmin(admin.ModelAdmin):
    list_display = (
        "transaction",
        "security",
        "holding",
        "cash_balance",
        "quantity",
        "price_per_unit",
        "total_value",
    )
    list_filter = ("security__asset_class", "security__structure")
    search_fields = (
        "transaction__id",
        "security__ticker",
        "security__name",
    )
    autocomplete_fields = (
        "transaction",
        "security",
        "holding",
        "cash_balance",
    )

from django.contrib import admin

from .models import (
    Account,
    CashBalance,
    Currency,
    Holding,
    Security,
    SecurityPrice,
)


class CashBalanceInline(admin.TabularInline):
    model = CashBalance
    extra = 0
    fields = ("currency", "balance", "created_on", "updated_on")
    readonly_fields = ("created_on", "updated_on")


class HoldingInline(admin.TabularInline):
    model = Holding
    extra = 0
    fields = (
        "security",
        "quantity",
        "average_cost",
        "cost_basis",
        "created_on",
        "updated_on",
    )
    readonly_fields = ("cost_basis", "created_on", "updated_on")


class SecurityPriceInline(admin.TabularInline):
    model = SecurityPrice
    extra = 0
    fields = ("date", "price", "source", "created_on", "updated_on")
    readonly_fields = ("created_on", "updated_on")


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "type", "deleted", "updated_on")
    list_filter = ("type", "deleted", "created_on", "updated_on")
    search_fields = ("name", "user__email", "user__name")
    readonly_fields = ("created_on", "updated_on")
    inlines = (CashBalanceInline, HoldingInline)


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "symbol",
        "currency_type",
        "exchange_rate_regime",
        "is_active",
    )
    list_filter = ("currency_type", "exchange_rate_regime", "is_active")
    search_fields = ("code", "name", "symbol")
    readonly_fields = ("created_on", "updated_on")


@admin.register(CashBalance)
class CashBalanceAdmin(admin.ModelAdmin):
    list_display = ("account", "currency", "balance", "updated_on")
    list_filter = ("currency", "created_on", "updated_on")
    search_fields = ("account__name", "account__user__email", "currency__code")
    readonly_fields = ("created_on", "updated_on")
    autocomplete_fields = ("account", "currency")


@admin.register(Security)
class SecurityAdmin(admin.ModelAdmin):
    list_display = (
        "ticker",
        "name",
        "isin",
        "structure",
        "asset_class",
        "currency",
    )
    list_filter = ("structure", "asset_class", "currency")
    search_fields = ("ticker", "name", "isin")
    readonly_fields = ("created_on", "updated_on")
    autocomplete_fields = ("currency",)
    inlines = (SecurityPriceInline,)


@admin.register(SecurityPrice)
class SecurityPriceAdmin(admin.ModelAdmin):
    list_display = (
        "security",
        "date",
        "price",
        "source",
        "updated_on",
        "created_on",
    )
    list_filter = ("date", "source", "security__currency")
    search_fields = ("security__ticker", "security__name", "source")
    readonly_fields = ("created_on", "updated_on")
    autocomplete_fields = ("security",)


@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = (
        "account",
        "security",
        "quantity",
        "average_cost",
        "cost_basis",
        "updated_on",
    )
    list_filter = (
        "security__asset_class",
        "security__structure",
        "created_on",
    )
    search_fields = (
        "account__name",
        "account__user__email",
        "security__ticker",
        "security__name",
    )
    readonly_fields = ("cost_basis", "created_on", "updated_on")
    autocomplete_fields = ("account", "security")

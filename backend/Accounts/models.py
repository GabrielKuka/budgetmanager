from django.conf import settings
from django.db import models
from django.core.validators import RegexValidator


class Account(models.Model):
    account_types = [
        (0, "Bank Account"),
        (1, "Investment Account"),
        (2, "Hard Cash"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="accounts",
    )
    type = models.IntegerField(
        choices=account_types, default=0
    )  # Fix: was account_types[0] (a tuple)
    name = models.CharField(max_length=100, default="")
    # Legacy cash fields kept during the migration from one account per currency
    # to Account + CashBalance. Do not remove until the merge/backfill command has
    # safely moved existing data and transactions.
    amount = models.FloatField(default=0.0)
    currency = models.CharField(max_length=4, default="EUR")
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)
    deleted = models.BooleanField(default=False)

    def soft_delete(self):
        self.deleted = True
        self.save(update_fields=["deleted"])

    def restore(self):
        self.deleted = False
        self.save(update_fields=["deleted"])

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Currency(models.Model):

    CURRENCY_TYPE_CHOICES = [
        ("fiat", "Fiat"),
        ("crypto", "Cryptocurrency"),
    ]
    EXCHANGE_RATE_CHOICES = [
        ("floating", "Floating"),
        ("pegged", "Pegged"),
    ]

    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10)

    # Classification
    currency_type = models.CharField(
        max_length=10,
        choices=CURRENCY_TYPE_CHOICES,
        default="fiat",
    )
    exchange_rate_regime = models.CharField(
        max_length=10,
        choices=EXCHANGE_RATE_CHOICES,
        null=True,
        blank=True,
    )

    # Removed is_government_issued — redundant with currency_type
    # (crypto is never government-issued; fiat almost always is)

    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


class CashBalance(models.Model):
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="cash_balances",
    )
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,  # Never silently delete a referenced currency
        related_name="cash_balances",
    )

    balance = models.DecimalField(max_digits=19, decimal_places=8, default=0)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (
            "account",
            "currency",
        )  # One balance record per currency per account

    def __str__(self):
        return f"{self.account.name} — {self.currency.code}: {self.balance}"


class Security(models.Model):
    ASSET_CLASS_CHOICES = [
        ("equity", "Equity"),
        ("fixed_income", "Fixed Income"),  # bonds, bond ETFs, bond funds
        ("money_market", "Money Market"),  # MMF, MMF ETFs
        ("commodity", "Commodity"),
        ("real_estate", "Real Estate"),
        ("mixed", "Mixed"),
        ("other", "Other"),
    ]

    STRUCTURE_CHOICES = [
        ("stock", "Stock"),
        ("etf", "ETF"),
        ("mutual_fund", "Mutual Fund"),
        ("bond", "Bond"),  # individual bond
        ("other", "Other"),
    ]

    isin_validator = RegexValidator(
        regex=r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$",
        message="ISIN must be 12 characters: 2 letters + 9 alphanumeric + 1 digit (e.g. US0378331005)",
    )

    isin = models.CharField(
        max_length=12,
        null=True,
        blank=True,
        unique=True,
        validators=[isin_validator],
    )
    structure = models.CharField(
        max_length=20,
        choices=STRUCTURE_CHOICES,
        default="stock",
    )
    asset_class = models.CharField(
        max_length=20,
        choices=ASSET_CLASS_CHOICES,
        default="equity",
    )
    name = models.CharField(max_length=100)
    ticker = models.CharField(max_length=10, unique=True)  # Prevent silent duplicates
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,  # Never silently delete a referenced currency
        related_name="securities",
    )
    description = models.CharField(max_length=100, null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.ticker}"


class SecurityPrice(models.Model):
    security = models.ForeignKey(
        Security,
        on_delete=models.CASCADE,
        related_name="prices",
    )
    date = models.DateField()
    price = models.DecimalField(max_digits=19, decimal_places=8)
    source = models.CharField(max_length=100, default="manual")
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("security", "date", "source")
        ordering = ["-date", "-created_on"]

    def __str__(self):
        return f"{self.security.ticker} — {self.price} ({self.date})"


class Holding(models.Model):
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="holdings",
    )
    security = models.ForeignKey(
        Security,
        on_delete=models.PROTECT,  # Preserve holding history if a security is removed
        related_name="holdings",
    )
    quantity = models.DecimalField(max_digits=19, decimal_places=8, default=0)
    average_cost = models.DecimalField(max_digits=19, decimal_places=8, default=0)

    # cost_basis is dropped as a stored field — it is always quantity × average_cost.
    # Storing it separately risks the two values drifting out of sync.
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (
            "account",
            "security",
        )  # One holding record per security per account

    @property
    def cost_basis(self):
        return self.quantity * self.average_cost

    def __str__(self):
        return f"{self.account.name} — {self.security.ticker}: {self.quantity}"

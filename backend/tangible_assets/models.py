from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Unit(models.Model):
    DIMENSION_CHOICES = [
        ("count", "Count"),
        ("mass", "Mass"),
        ("volume", "Volume"),
        ("area", "Area"),
        ("length", "Length"),
        ("other", "Other"),
    ]

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20, blank=True, default="")
    dimension = models.CharField(
        max_length=20, choices=DIMENSION_CHOICES, default="other"
    )

    # null = this unit is itself the base for its dimension (e.g. grams for mass)
    # non-null = multiply by this factor to reach the base unit
    factor_to_base = models.DecimalField(
        max_digits=20, decimal_places=10, null=True, blank=True
    )

    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} ({self.name})"


# ---------------------------------------------------------------------------
# Abstract base — shared fields across all tangible asset types
# ---------------------------------------------------------------------------


class TangibleAsset(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    name = models.CharField(max_length=200)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(
        max_digits=19, decimal_places=4, null=True, blank=True
    )
    currency = models.ForeignKey(
        "Accounts.Currency",
        on_delete=models.PROTECT,  # never silently orphan an asset's currency
        null=True,
        blank=True,
    )
    notes = models.TextField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# Concrete asset types
# ---------------------------------------------------------------------------


class Property(TangibleAsset):
    PROPERTY_TYPE_CHOICES = [
        ("residential", "Residential"),
        ("commercial", "Commercial"),
        ("land", "Land"),
        ("other", "Other"),
    ]

    property_type = models.CharField(
        max_length=20, choices=PROPERTY_TYPE_CHOICES, default="residential"
    )
    address = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.get_property_type_display()})"


class PhysicalAsset(TangibleAsset):
    ASSET_TYPE_CHOICES = [
        ("precious_metal", "Precious Metal"),
        ("art", "Art"),
        ("collectible", "Collectible"),
        ("vehicle", "Vehicle"),
        ("other", "Other"),
    ]

    asset_type = models.CharField(
        max_length=20, choices=ASSET_TYPE_CHOICES, default="other"
    )
    unit = models.ForeignKey(
        Unit, on_delete=models.PROTECT, null=True, blank=True
    )
    quantity = models.DecimalField(
        max_digits=19, decimal_places=8, null=True, blank=True
    )
    purity = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )

    def __str__(self):
        return f"{self.name} ({self.get_asset_type_display()})"


# ---------------------------------------------------------------------------
# Valuation history — replaces the single current_value field
# ---------------------------------------------------------------------------


class PropertyValuation(models.Model):
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="valuations"
    )
    date = models.DateField()
    value = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.ForeignKey("Accounts.Currency", on_delete=models.PROTECT)
    notes = models.CharField(max_length=200, null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.property.name} — {self.value} ({self.date})"


class PhysicalAssetValuation(models.Model):
    asset = models.ForeignKey(
        PhysicalAsset, on_delete=models.CASCADE, related_name="valuations"
    )
    date = models.DateField()
    value = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.ForeignKey("Accounts.Currency", on_delete=models.PROTECT)
    notes = models.CharField(max_length=200, null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.asset.name} — {self.value} ({self.date})"

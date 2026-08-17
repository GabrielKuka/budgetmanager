from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Unit(models.Model):
    DIMENSION_CHOICES = [
        ("count", "Count"),
        ("mass", "Mass"),
        ("area", "Area"),
        ("other", "Other"),
    ]

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20, blank=True, default="")
    dimension = models.CharField(
        max_length=20, choices=DIMENSION_CHOICES, default="other"
    )
    factor_to_base = models.DecimalField(
        max_digits=20, decimal_places=10, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} ({self.name})"


class TangibleAsset(models.Model):
    ASSET_TYPE_CHOICES = [
        ("real_estate", "Owned Real Estate"),
        ("vehicle", "Vehicle"),
        ("precious_metal", "Precious Metal"),
        ("art", "Art"),
        ("collectible", "Collectible"),
        ("other", "Other Tangible Asset"),
    ]
    PROPERTY_TYPE_CHOICES = [
        ("residential", "Residential"),
        ("commercial", "Commercial"),
        ("land", "Land"),
        ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("sold", "Sold"),
        ("disposed", "Disposed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tangible_assets",
    )
    name = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES)
    acquired_on = models.DateField()
    acquisition_cost = models.DecimalField(
        max_digits=19,
        decimal_places=4,
        validators=[MinValueValidator(0)],
    )
    currency = models.ForeignKey(
        "Accounts.Currency",
        on_delete=models.PROTECT,
        related_name="tangible_assets",
    )
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="active"
    )
    disposed_on = models.DateField(null=True, blank=True)
    disposal_reason = models.CharField(max_length=200, blank=True, default="")

    property_type = models.CharField(
        max_length=20,
        choices=PROPERTY_TYPE_CHOICES,
        null=True,
        blank=True,
    )
    address = models.CharField(max_length=255, blank=True, default="")
    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assets",
    )
    quantity = models.DecimalField(
        max_digits=19,
        decimal_places=8,
        default=1,
        validators=[MinValueValidator(0.00000001)],
    )
    purity = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-acquired_on", "-id"]

    def clean(self):
        errors = {}
        if self.asset_type == "real_estate" and not self.property_type:
            errors["property_type"] = "Real estate requires a property type."
        if self.asset_type != "real_estate" and self.property_type:
            errors["property_type"] = "Only real estate has a property type."
        if self.asset_type != "precious_metal" and self.purity is not None:
            errors["purity"] = "Purity is only available for precious metals."
        if self.disposed_on and self.disposed_on < self.acquired_on:
            errors["disposed_on"] = "Disposition cannot predate acquisition."
        if self.status == "active" and self.disposed_on:
            errors["disposed_on"] = "Active asset cannot have a disposition date."
        if self.status != "active" and not self.disposed_on:
            errors["disposed_on"] = "Inactive asset requires a disposition date."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.name} ({self.get_asset_type_display()})"


class TangibleAssetValuation(models.Model):
    SOURCE_CHOICES = [
        ("acquisition", "Acquisition"),
        ("manual", "Manual"),
    ]

    asset = models.ForeignKey(
        TangibleAsset,
        on_delete=models.CASCADE,
        related_name="valuations",
    )
    date = models.DateField()
    value = models.DecimalField(
        max_digits=19,
        decimal_places=4,
        validators=[MinValueValidator(0.0001)],
    )
    notes = models.CharField(max_length=200, blank=True, default="")
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default="manual"
    )
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["asset", "date"], name="tangible_asset_valuation_day"
            )
        ]

    def clean(self):
        if self.date < self.asset.acquired_on:
            raise ValidationError({"date": "Valuation predates acquisition."})
        if self.asset.disposed_on and self.date > self.asset.disposed_on:
            raise ValidationError({"date": "Valuation follows disposition."})

    def __str__(self):
        return f"{self.asset.name} — {self.value} ({self.date})"

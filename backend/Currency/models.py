from django.db import models


class ExchangeRate(models.Model):
    PROVIDER_FRANKFURTER = "frankfurter"

    date = models.DateField()
    base_currency = models.CharField(max_length=3, default="USD")
    quote_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=20, decimal_places=10)
    provider = models.CharField(max_length=50, default=PROVIDER_FRANKFURTER)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "date",
                    "base_currency",
                    "quote_currency",
                    "provider",
                ],
                name="unique_exchange_rate_per_day_provider",
            )
        ]
        indexes = [
            models.Index(
                fields=["date", "base_currency", "quote_currency"],
                name="fx_rate_lookup_idx",
            )
        ]

    def __str__(self):
        return (
            f"{self.date} {self.base_currency}/"
            f"{self.quote_currency} {self.rate}"
        )

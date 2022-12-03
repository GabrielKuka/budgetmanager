from django.contrib import admin

from .models import FactTransaction, DimIncomeCategory, DimExpenseCategory

admin.site.register(FactTransaction)
admin.site.register(DimIncomeCategory)
admin.site.register(DimExpenseCategory)

from django.contrib import admin

from .models import Expense, ExpenseCategory, Income, IncomeCategory, Transfer

admin.site.register(IncomeCategory)
admin.site.register(ExpenseCategory)
admin.site.register(Expense)
admin.site.register(Income)
admin.site.register(Transfer)

from django.contrib import admin

from .models import Expense, Income, Transaction, Transfer, TransactionCategory

admin.site.register(Expense)
admin.site.register(Income)
admin.site.register(Transfer)
admin.site.register(Transaction)
admin.site.register(TransactionCategory)

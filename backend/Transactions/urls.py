from . import views
from django.urls import path

urlpatterns = [
    path("add", views.add_transaction, name="add-transaction"),
    path("all", views.get_all_transactions, name="get-all-transactions"),
    path("allexpenses", views.get_all_expenses, name="get-all-expenses"),
    path("allincomes", views.get_all_incomes, name="get-all-incomes"),
    path("alltransfers", views.get_all_transfers, name="get-all-transfers"),
    path(
        "incomecategories",
        views.get_income_categories,
        name="get-income-categories",
    ),
    path(
        "expensecategories",
        views.get_expense_categories,
        name="get-expense-categories",
    ),
]

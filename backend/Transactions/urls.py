from django.urls import path

from . import views

urlpatterns = [
    path("add", views.add_transaction, name="add-transaction"),
    path("delete", views.delete_transaction, name="delete-transaction"),
    path("all", views.get_all_transactions, name="get-all-transactions"),
    path("allexpenses", views.get_all_expenses, name="get-all-expenses"),
    path("allincomes", views.get_all_incomes, name="get-all-incomes"),
    path("alltransfers", views.get_all_transfers, name="get-all-transfers"),
    path("get_transactions", views.get_transactions, name="get-transactions"),
    path("get_expenses", views.get_expenses, name="get-expenses"),
    path("get_incomes", views.get_incomes, name="get-incomes"),
    path("get_transfers", views.get_transfers, name="get-transfers"),
    path("search", views.search, name="search"),
    path("get_wealth_stats", views.get_wealth_stats, name="get-wealth-stats"),
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

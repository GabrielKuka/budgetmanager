from django.urls import path

from . import views

urlpatterns = [
    path("", views.account_collection, name="accounts"),
    path("totals", views.account_totals, name="account_totals"),
    path("<int:account_id>", views.account_detail, name="account"),
    path("<int:account_id>/stats", views.account_stats, name="account_stats"),
    path(
        "<int:account_id>/transactions",
        views.account_transactions,
        name="account_transactions",
    ),
    # Legacy URLs kept for compatibility with existing frontend service calls.
    path("all", views.account_collection, name="allaccounts"),
    path("create", views.account_collection, name="createaccount"),
    path("delete/<int:account_id>", views.account_detail, name="deleteaccount"),
    path(
        "soft_delete/<int:account_id>",
        views.account_detail,
        {"deleted": True},
        name="soft_delete",
    ),
    path(
        "restore/<int:account_id>",
        views.account_detail,
        {"deleted": False},
        name="restore_account",
    ),
    path(
        "transactions/<int:account_id>",
        views.account_transactions,
        name="gettransactions",
    ),
    path("stats/<int:account_id>", views.account_stats, name="accountdata"),
]

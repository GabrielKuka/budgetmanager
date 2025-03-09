from django.urls import path

from . import views

urlpatterns = [
    path("create", views.create_account, name="createaccount"),
    path(
        "soft_delete/<int:account_id>", views.soft_delete, name="soft_delete"
    ),
    path(
        "restore/<int:account_id>",
        views.restore_account,
        name="restore_account",
    ),
    path("delete/<int:id>", views.delete_account, name="deleteaccount"),
    path(
        "transactions/<int:id>",
        views.get_account_transactions,
        name="gettransactions",
    ),
    path("all", views.get_all_accounts, name="allaccounts"),
]

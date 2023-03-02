from . import views
from django.urls import path

urlpatterns = [
    path("create", views.create_account, name="createaccount"),
    path("delete/<int:id>", views.delete_account, name="deleteaccount"),
    path("all", views.get_all_accounts, name="allaccounts"),
]

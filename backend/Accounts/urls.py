from . import views
from django.urls import path

urlpatterns = [
    path("create", views.create_account, name="createaccount"),
    path("all", views.get_all_accounts, name="allaccounts"),
]

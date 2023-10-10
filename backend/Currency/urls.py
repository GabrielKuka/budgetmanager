from django.urls import path

from . import views

urlpatterns = [
    path(
        "convert/<str:base>/<str:to>/<str:amount>",
        views.convert,
        name="convert",
    ),
    path(
        "convert_on_type/<str:currency>/<int:type>",
        views.convert_account_currency_on_type,
        name="convert_account_currency_on_type",
    ),
]

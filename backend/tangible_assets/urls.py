from django.urls import path

from . import views


urlpatterns = [
    path("portfolio", views.portfolio, name="assets-portfolio"),
    path("activity", views.activity, name="assets-activity"),
    path("securities", views.securities, name="assets-securities"),
    path("", views.asset_collection, name="tangible-assets"),
    path("units", views.units, name="tangible-asset-units"),
    path("purchase", views.purchase, name="tangible-asset-purchase"),
    path("<int:asset_id>", views.asset_detail, name="tangible-asset"),
    path(
        "<int:asset_id>/valuations",
        views.valuations,
        name="tangible-valuations",
    ),
    path(
        "<int:asset_id>/valuations/<int:valuation_id>",
        views.valuation_detail,
        name="tangible-valuation",
    ),
    path("<int:asset_id>/sell", views.sell, name="tangible-asset-sell"),
    path(
        "<int:asset_id>/dispose", views.dispose, name="tangible-asset-dispose"
    ),
    path(
        "<int:asset_id>/undo-last-event",
        views.undo_last_event,
        name="tangible-asset-undo",
    ),
]

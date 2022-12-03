from . import views
from django.urls import path

urlpatterns = [
    path("register", views.CreateUserView.as_view(), name="createuser"),
    path("token", views.CreateTokenView.as_view(), name="createtoken"),
    path("me", views.ManageUserView.as_view(), name="me"),
]

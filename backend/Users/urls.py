from django.urls import path

from . import views

urlpatterns = [
    path("register", views.CreateUserView.as_view(), name="createuser"),
    path("token", views.CreateTokenView.as_view(), name="createtoken"),
    path("me", views.ManageUserView.as_view(), name="me"),
    path("user_data", views.get_user_data, name="get_user_data"),
]

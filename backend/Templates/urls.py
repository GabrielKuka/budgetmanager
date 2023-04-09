from . import views
from django.urls import path

urlpatterns = [
    path("add-template", views.add_template, name="add-template"),
    path(
        "delete-template/<int:id>",
        views.delete_template,
        name="delete-template",
    ),
    path("update-template", views.update_template, name="update-template"),
    path("get-templates", views.get_templates, name="get-templates"),
    path(
        "get-template-groups", views.get_templates, name="get-template-groups"
    ),
    path("add-template-group", views.get_templates, name="add-template-group"),
    path(
        "delete-template-group/<int:id>",
        views.delete_template_group,
        name="delete-template-group",
    ),
]

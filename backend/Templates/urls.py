from django.urls import path

from . import views

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
        "get-template-groups",
        views.get_template_groups,
        name="get-template-groups",
    ),
    path(
        "add-template-group",
        views.add_template_group,
        name="add-template-group",
    ),
    path(
        "delete-template-group/<int:id>",
        views.delete_template_group,
        name="delete-template-group",
    ),
]

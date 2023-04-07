from views import add_template, delete_template, update_template, get_templates
from django.urls import path

urlpatterns = [
    path("add-template", add_template, name="add-template"),
    path(
        "delete-template/<int:id>",
        delete_template,
        name="delete-template",
    ),
    path("update-template", update_template, name="update-template"),
    path("get-templates", get_templates, name="get-templates"),
]


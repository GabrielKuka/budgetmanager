from django.contrib import admin

from .models import Template, TemplateGroup

admin.site.register(Template)
admin.site.register(TemplateGroup)

from django.contrib import admin

from .models import Unit, Property, PhysicalAsset

admin.site.register(Unit)
admin.site.register(Property)
admin.site.register(PhysicalAsset)
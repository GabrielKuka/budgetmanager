from django.contrib import admin

from .models import TangibleAsset, TangibleAssetValuation, Unit

admin.site.register(Unit)
admin.site.register(TangibleAsset)
admin.site.register(TangibleAssetValuation)

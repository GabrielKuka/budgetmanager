from .models import Template, TemplateGroup
from rest_framework import serializers


class TemplateSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Template
        fields = "__all__"


class TemplateGroupSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = TemplateGroup
        fields = "__all__"

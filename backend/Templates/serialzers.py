from .models import Template
from rest_framework import serializers


class TemplateSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Template
        fields = "__all__"


class TemplateGroupSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Template
        fields = "__all__"

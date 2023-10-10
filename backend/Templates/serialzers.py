from rest_framework import serializers

from .models import Template, TemplateGroup


class TemplateSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Template
        fields = "__all__"


class TemplateGroupSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    template_group = TemplateSerializer(many=True)

    class Meta:
        model = TemplateGroup
        fields = ("id", "name", "created_on", "user", "template_group")

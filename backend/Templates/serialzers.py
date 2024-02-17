from rest_framework import serializers

from .models import Template, TemplateGroup
from tags.models import Tag
from tags.serializers import TagSerializer


class TemplateSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Template
        fields = "__all__"

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        template = Template.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_data["name"])
            template.tags.add(tag)

        return template


class TemplateGroupSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    template_group = TemplateSerializer(many=True)

    class Meta:
        model = TemplateGroup
        fields = ("id", "name", "created_on", "user", "template_group")

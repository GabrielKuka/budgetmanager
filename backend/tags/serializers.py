from rest_framework import serializers
from .models import Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"

    def create(self, validated_data):
        tag, created = Tag.objects.get_or_create(**validated_data)

        if not created:
            return serializers.ValidationError(
                f"{validated_data['name']} already exists"
            )
        return tag

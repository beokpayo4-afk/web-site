from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ObjectDoesNotExist
from django.core.mail import send_mail
from django.core.validators import RegexValidator
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import Address, CustomerProfile
from apps.accounts.security import blacklist_user_refresh_tokens

User = get_user_model()


def user_display_name(user) -> str:
    try:
        name = user.profile.full_name
        if name:
            return name
    except ObjectDoesNotExist:
        pass
    return f"{user.first_name} {user.last_name}".strip()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="profile.full_name", read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone", "role", "full_name", "is_active", "date_joined")
        read_only_fields = fields


class AdminCustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    order_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone", "role", "full_name", "is_active", "date_joined", "order_count")
        read_only_fields = ("id", "email", "phone", "role", "full_name", "date_joined", "order_count")

    def get_full_name(self, obj):
        return user_display_name(obj)

    def update(self, instance, validated_data):
        payload = getattr(self, "initial_data", {}) or {}
        blocked = {"role", "email", "phone"} & set(payload.keys())
        if blocked:
            raise serializers.ValidationError({field: "This field cannot be changed from this endpoint." for field in blocked})
        instance.is_active = validated_data.get("is_active", instance.is_active)
        instance.save(update_fields=["is_active"])
        return instance


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        return value

    def validate(self, attrs):
        stub = User(email=attrs["email"], username=attrs["email"], first_name=attrs["full_name"].split(" ")[0])
        validate_password(attrs["password"], stub)
        return attrs

    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
            phone=validated_data.get("phone", ""),
            first_name=full_name.split(" ")[0],
            last_name=" ".join(full_name.split(" ")[1:]),
            role=User.Role.CUSTOMER,
        )
        CustomerProfile.objects.update_or_create(user=user, defaults={"full_name": full_name})
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token

    def validate(self, attrs):
        if email := attrs.get("email"):
            attrs["email"] = email.lower().strip()
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True)
    role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = CustomerProfile
        fields = ("id", "email", "full_name", "phone", "date_of_birth", "role")
        read_only_fields = ("id", "email", "role")
        extra_kwargs = {"full_name": {"required": False}}

    def validate(self, attrs):
        attrs.pop("role", None)
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        if "phone" in user_data:
            instance.user.phone = user_data["phone"]
            instance.user.save(update_fields=["phone"])
        return super().update(instance, validated_data)


class AddressSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(
        max_length=15,
        validators=[RegexValidator(r"^[6-9]\d{9}$", "Enter a valid 10-digit Indian mobile number.")],
    )
    postal_code = serializers.CharField(
        max_length=12,
        validators=[RegexValidator(r"^\d{6}$", "Enter a valid 6-digit PIN code.")],
    )

    class Meta:
        model = Address
        fields = (
            "id",
            "label",
            "full_name",
            "phone",
            "line1",
            "line2",
            "city",
            "state",
            "postal_code",
            "country",
            "address_type",
            "is_default",
        )

    def validate_country(self, value):
        if value.strip().lower() not in {"india", "in"}:
            raise serializers.ValidationError("Nexora currently ships within India only.")
        return value or "India"

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=user, is_default=True).update(is_default=False)
        elif not Address.objects.filter(user=user).exists():
            validated_data["is_default"] = True
        return Address.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Address.objects.filter(user=instance.user, is_default=True).exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        blacklist_user_refresh_tokens(user)
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        email = self.validated_data["email"].lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        send_mail(
            subject="Reset your Nexora password",
            message=f"Use this reset token with your app.\nuid: {uid}\ntoken: {token}",
            from_email=None,
            recipient_list=[user.email],
            fail_silently=True,
        )


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self, **kwargs):
        try:
            user_id = force_str(urlsafe_base64_decode(self.validated_data["uid"]))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError) as exc:
            raise serializers.ValidationError({"uid": "Invalid reset link."}) from exc
        if not default_token_generator.check_token(user, self.validated_data["token"]):
            raise serializers.ValidationError({"token": "This reset link is invalid or has expired."})
        blacklist_user_refresh_tokens(user)
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", _("Super Admin")
        PRODUCT_MANAGER = "PRODUCT_MANAGER", _("Product Manager")
        ORDER_MANAGER = "ORDER_MANAGER", _("Order Manager")
        INVENTORY_MANAGER = "INVENTORY_MANAGER", _("Inventory Manager")
        CUSTOMER_SUPPORT = "CUSTOMER_SUPPORT", _("Customer Support")
        CUSTOMER = "CUSTOMER", _("Customer")

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    phone = models.CharField(max_length=15, blank=True)
    is_email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role", "is_active"]),
        ]

    def __str__(self):
        return self.email

    @property
    def is_staff_role(self):
        return self.role != self.Role.CUSTOMER


class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name or self.user.email


class Address(models.Model):
    class AddressType(models.TextChoices):
        SHIPPING = "SHIPPING", _("Shipping")
        BILLING = "BILLING", _("Billing")
        BOTH = "BOTH", _("Both")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=40, blank=True)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15)
    line1 = models.CharField(max_length=160)
    line2 = models.CharField(max_length=160, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    postal_code = models.CharField(max_length=12)
    country = models.CharField(max_length=60, default="India")
    address_type = models.CharField(max_length=16, choices=AddressType.choices, default=AddressType.BOTH)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_default"]),
            models.Index(fields=["postal_code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(is_default=True),
                name="unique_default_address_per_user",
            )
        ]

    def __str__(self):
        return f"{self.full_name} — {self.city}"

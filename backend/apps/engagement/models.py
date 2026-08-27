from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.orders.models import Order


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120)
    body = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    is_approved = models.BooleanField(default=False)
    moderation_note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "user"], name="one_review_per_user_product"),
        ]
        indexes = [
            models.Index(fields=["product", "is_approved"]),
            models.Index(fields=["product", "status"]),
            models.Index(fields=["rating"]),
            models.Index(fields=["user", "status"]),
        ]
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.status == self.Status.APPROVED:
            self.is_approved = True
        elif self.status == self.Status.REJECTED:
            self.is_approved = False
        elif self.is_approved:
            self.status = self.Status.APPROVED
        else:
            self.is_approved = False
        super().save(*args, **kwargs)

    @property
    def is_verified_purchase(self):
        return self.order_id is not None

    def __str__(self):
        return f"{self.product_id} · {self.user_id} · {self.rating}"


class Notification(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "IN_APP", "In-app"
        EMAIL = "EMAIL", "Email"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=140)
    message = models.TextField()
    channel = models.CharField(max_length=16, choices=Channel.choices, default=Channel.IN_APP)
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read", "created_at"])]


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=160)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email"]), models.Index(fields=["is_resolved"])]

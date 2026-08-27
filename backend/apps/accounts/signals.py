from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import CustomerProfile, User
from apps.commerce.models import Cart, Wishlist


@receiver(post_save, sender=User)
def create_customer_defaults(sender, instance, created, **kwargs):
    if not created:
        return
    CustomerProfile.objects.get_or_create(user=instance, defaults={"full_name": instance.get_full_name()})
    Cart.objects.get_or_create(user=instance)
    Wishlist.objects.get_or_create(user=instance)

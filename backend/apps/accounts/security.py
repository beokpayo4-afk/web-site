from django.contrib.auth import get_user_model
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

User = get_user_model()


def blacklist_user_refresh_tokens(user: User) -> None:
    """Invalidate outstanding refresh tokens after logout-worthy events."""
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)

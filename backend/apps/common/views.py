from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle


class HealthThrottle(AnonRateThrottle):
    rate = "60/min"


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([HealthThrottle])
def health(_request):
    return Response({"status": "ok"})

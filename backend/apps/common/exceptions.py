from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    message = "Request could not be completed."
    details = data

    if isinstance(data, dict):
        if "detail" in data:
            message = str(data["detail"])
            details = {k: v for k, v in data.items() if k != "detail"} or None
        elif "non_field_errors" in data:
            message = "; ".join(str(item) for item in data["non_field_errors"])
    elif isinstance(data, list) and data:
        message = str(data[0])

    response.data = {
        "success": False,
        "error": {
            "status": response.status_code,
            "message": message,
            "details": details,
        },
    }
    return response


class ConflictError(APIException):
    status_code = 409
    default_detail = "This resource conflicts with the current state."
    default_code = "conflict"

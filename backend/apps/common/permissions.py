from rest_framework.permissions import BasePermission

STAFF_ROLES = {
    "SUPER_ADMIN",
    "PRODUCT_MANAGER",
    "ORDER_MANAGER",
    "INVENTORY_MANAGER",
    "CUSTOMER_SUPPORT",
}

ROLE_PERMISSIONS = {
    "SUPER_ADMIN": {
        "dashboard",
        "products",
        "categories",
        "brands",
        "inventory",
        "orders",
        "customers",
        "reviews",
        "coupons",
        "shipping",
        "notifications",
        "reports",
        "settings",
    },
    "PRODUCT_MANAGER": {"dashboard", "products", "categories", "brands", "reviews"},
    "ORDER_MANAGER": {"dashboard", "orders", "shipping", "customers"},
    "INVENTORY_MANAGER": {"dashboard", "inventory", "products"},
    # support role is stored as CUSTOMER_SUPPORT
    "CUSTOMER_SUPPORT": {"dashboard", "orders", "customers", "reviews", "notifications"},
}


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", None) == "CUSTOMER")


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in STAFF_ROLES)


class HasAdminPermission(BasePermission):
    permission_area = ""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        allowed = ROLE_PERMISSIONS.get(user.role, set())
        area = getattr(view, "permission_area", self.permission_area)
        return area in allowed


class IsCatalogReadOrProductStaff(BasePermission):
    """Public catalog reads; product writes require a staff products permission."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        user = request.user
        if not user or not user.is_authenticated or getattr(user, "role", None) not in STAFF_ROLES:
            return False
        return "products" in ROLE_PERMISSIONS.get(user.role, set())

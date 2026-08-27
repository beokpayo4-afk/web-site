from django.urls import path

from apps.accounts.views import (
    AddressDetailView,
    AddressListCreateView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    ProfileView,
    RefreshView,
    RegisterView,
    ResetPasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("change-password/", PasswordChangeView.as_view(), name="change_password"),
    path("password/change/", PasswordChangeView.as_view(), name="password_change"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("addresses/", AddressListCreateView.as_view(), name="addresses"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="address_detail"),
]

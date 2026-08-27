import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { GuestOnly, RequireAdminArea, RequireAuth, RequireStaff } from '@/components/layout/Guards'
import { AppQueryProvider } from '@/providers/AppQueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { AccountLayout, AddressesPage, NotificationsPage, SettingsPage, WishlistPage, MyReviewsPage } from '@/pages/AccountPages'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminHomePage } from '@/pages/admin/AdminHomePage'
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage'
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage'
import { AdminProductDetailPage } from '@/pages/admin/AdminProductDetailPage'
import { AdminProductFormPage } from '@/pages/admin/AdminProductFormPage'
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/pages/AuthPages'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { policies } from '@/content/policies'
import { AboutPage, ContactPage, FaqPage, PolicyPage } from '@/pages/ContentPages'
import { HomePage } from '@/pages/HomePage'
import { OrderSuccessPage } from '@/pages/OrderSuccessPage'
import { OrderDetailsPage, OrdersPage } from '@/pages/OrdersPages'
import { ProductDetailsPage } from '@/pages/ProductDetailsPage'
import { CategoryPage, SearchPage, ShopPage } from '@/pages/ShopPage'

function CategoryRoute() {
  const { slug = '' } = useParams()
  return <CategoryPage slug={slug} />
}

export default function App() {
  return (
    <AppQueryProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/category/:slug" element={<CategoryRoute />} />
              <Route path="/product/:slug" element={<ProductDetailsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route element={<GuestOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacy" element={<PolicyPage title="Privacy Policy" body={policies.privacy} />} />
              <Route path="/terms" element={<PolicyPage title="Terms" body={policies.terms} />} />
              <Route path="/shipping-policy" element={<PolicyPage title="Shipping Policy" body={policies.shipping} />} />
              <Route path="/return-policy" element={<PolicyPage title="Return Policy" body={policies.returns} />} />
              <Route path="/refund-policy" element={<PolicyPage title="Refund Policy" body={policies.refunds} />} />
              <Route path="/cancellation-policy" element={<PolicyPage title="Cancellation Policy" body={policies.cancellation} />} />
              <Route element={<RequireAuth />}>
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order-success/:id" element={<OrderSuccessPage />} />
                <Route path="/account" element={<AccountLayout />}>
                  <Route index element={<Navigate to="/account/settings" replace />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/:id" element={<OrderDetailsPage />} />
                  <Route path="wishlist" element={<WishlistPage />} />
                  <Route path="reviews" element={<MyReviewsPage />} />
                  <Route path="addresses" element={<AddressesPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route element={<RequireStaff />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route element={<RequireAdminArea area="dashboard" />}>
                  <Route index element={<AdminHomePage />} />
                </Route>
                <Route element={<RequireAdminArea area="products" />}>
                  <Route path="products" element={<AdminProductsPage />} />
                  <Route path="products/new" element={<AdminProductFormPage />} />
                  <Route path="products/:id" element={<AdminProductDetailPage />} />
                  <Route path="products/:id/edit" element={<AdminProductFormPage />} />
                </Route>
                <Route element={<RequireAdminArea area="orders" />}>
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="orders/:id" element={<AdminOrderDetailPage />} />
                </Route>
                <Route element={<RequireAdminArea area="settings" />}>
                  <Route path="settings" element={<AdminSettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppQueryProvider>
  )
}

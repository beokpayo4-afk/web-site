import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { GuestOnly, RequireAdminArea, RequireAuth, RequireStaff } from '@/components/layout/Guards'
import { policies } from '@/content/policies'
import { AppQueryProvider } from '@/providers/AppQueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'

function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(
  loader: () => Promise<M>,
  exportName: K,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType<any> }
  })
}

const HomePage = lazyNamed(() => import('@/pages/HomePage'), 'HomePage')
const ShopPage = lazyNamed(() => import('@/pages/ShopPage'), 'ShopPage')
const CategoryPage = lazyNamed(() => import('@/pages/ShopPage'), 'CategoryPage')
const SearchPage = lazyNamed(() => import('@/pages/ShopPage'), 'SearchPage')
const ProductDetailsPage = lazyNamed(() => import('@/pages/ProductDetailsPage'), 'ProductDetailsPage')
const CartPage = lazyNamed(() => import('@/pages/CartPage'), 'CartPage')
const CheckoutPage = lazyNamed(() => import('@/pages/CheckoutPage'), 'CheckoutPage')
const OrderSuccessPage = lazyNamed(() => import('@/pages/OrderSuccessPage'), 'OrderSuccessPage')
const LoginPage = lazyNamed(() => import('@/pages/AuthPages'), 'LoginPage')
const RegisterPage = lazyNamed(() => import('@/pages/AuthPages'), 'RegisterPage')
const ForgotPasswordPage = lazyNamed(() => import('@/pages/AuthPages'), 'ForgotPasswordPage')
const ResetPasswordPage = lazyNamed(() => import('@/pages/AuthPages'), 'ResetPasswordPage')
const AboutPage = lazyNamed(() => import('@/pages/ContentPages'), 'AboutPage')
const ContactPage = lazyNamed(() => import('@/pages/ContentPages'), 'ContactPage')
const FaqPage = lazyNamed(() => import('@/pages/ContentPages'), 'FaqPage')
const PolicyPage = lazyNamed(() => import('@/pages/ContentPages'), 'PolicyPage')
const AccountLayout = lazyNamed(() => import('@/pages/AccountPages'), 'AccountLayout')
const AddressesPage = lazyNamed(() => import('@/pages/AccountPages'), 'AddressesPage')
const NotificationsPage = lazyNamed(() => import('@/pages/AccountPages'), 'NotificationsPage')
const SettingsPage = lazyNamed(() => import('@/pages/AccountPages'), 'SettingsPage')
const WishlistPage = lazyNamed(() => import('@/pages/AccountPages'), 'WishlistPage')
const MyReviewsPage = lazyNamed(() => import('@/pages/AccountPages'), 'MyReviewsPage')
const OrdersPage = lazyNamed(() => import('@/pages/OrdersPages'), 'OrdersPage')
const OrderDetailsPage = lazyNamed(() => import('@/pages/OrdersPages'), 'OrderDetailsPage')
const AdminLayout = lazyNamed(() => import('@/components/layout/AdminLayout'), 'AdminLayout')
const AdminLoginPage = lazyNamed(() => import('@/pages/admin/AdminLoginPage'), 'AdminLoginPage')
const AdminHomePage = lazyNamed(() => import('@/pages/admin/AdminHomePage'), 'AdminHomePage')
const AdminOrdersPage = lazyNamed(() => import('@/pages/admin/AdminOrdersPage'), 'AdminOrdersPage')
const AdminOrderDetailPage = lazyNamed(() => import('@/pages/admin/AdminOrderDetailPage'), 'AdminOrderDetailPage')
const AdminProductsPage = lazyNamed(() => import('@/pages/admin/AdminProductsPage'), 'AdminProductsPage')
const AdminProductDetailPage = lazyNamed(() => import('@/pages/admin/AdminProductDetailPage'), 'AdminProductDetailPage')
const AdminProductFormPage = lazyNamed(() => import('@/pages/admin/AdminProductFormPage'), 'AdminProductFormPage')
const AdminSettingsPage = lazyNamed(() => import('@/pages/admin/AdminSettingsPage'), 'AdminSettingsPage')

function PageFallback() {
  return <p className="px-4 py-10 text-center text-sm text-ink-soft">Loading…</p>
}

function CategoryRoute() {
  const { slug = '' } = useParams()
  return <CategoryPage slug={slug} />
}

export default function App() {
  return (
    <AppQueryProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </AppQueryProvider>
  )
}

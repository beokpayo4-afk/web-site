import axios from 'axios'

import { api } from '@/lib/api'
import type { Cart, CartItem, Coupon, Order, Quote, WishlistItem } from '@/types/api'

export const commerceService = {
  cart() {
    return api.get<Cart>('/cart/').then((r) => r.data)
  },
  addItem(productId: number, quantity = 1) {
    return api.post<CartItem>('/cart/items/', { product_id: productId, quantity }).then((r) => r.data)
  },
  updateItem(id: number, quantity: number) {
    return api.patch<CartItem>(`/cart/items/${id}/`, { quantity }).then((r) => r.data)
  },
  removeItem(id: number) {
    return api.delete(`/cart/items/${id}/`)
  },
  wishlist() {
    return api.get<WishlistItem[]>('/wishlist/').then((r) => r.data)
  },
  addWishlist(productId: number) {
    return api.post<WishlistItem>('/wishlist/', { product_id: productId }).then((r) => r.data)
  },
  removeWishlist(id: number) {
    return api.delete(`/wishlist/${id}/`)
  },
  moveWishlistToCart(id: number) {
    return api.post<{ wishlist_item_id: number; cart_item: CartItem }>(`/wishlist/${id}/move-to-cart/`).then((r) => r.data)
  },
  quote(shippingState: string, couponCode?: string) {
    return api
      .post<Quote>('/checkout/quote/', { shipping_state: shippingState, coupon_code: couponCode })
      .then((r) => r.data)
  },
  preview(payload: {
    shipping_address_id: number
    billing_address_id?: number
    coupon_code?: string
    shipping_state?: string
  }) {
    return api
      .post<Quote>('/checkout/preview/', {
        shipping_address_id: payload.shipping_address_id,
        billing_address_id: payload.billing_address_id,
        coupon_code: payload.coupon_code,
      })
      .then((r) => r.data)
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 404 && payload.shipping_state) {
          return commerceService.quote(payload.shipping_state, payload.coupon_code)
        }
        throw error
      })
  },
  validateCoupon(code: string) {
    return api.post<Coupon>('/coupons/validate/', { code }).then((r) => r.data)
  },
  checkout(payload: { shipping_address_id: number; billing_address_id?: number; coupon_code?: string; customer_notes?: string }) {
    return api.post<Order>('/orders/', payload).then((r) => r.data)
  },
  completeMockPayment(payload: { provider_payment_id: string; outcome: 'success' | 'failed' | 'cancelled' }) {
    return api.post<Order>('/payments/mock/complete/', payload).then((r) => r.data)
  },
  verifyPayment(providerPaymentId: string) {
    return api.post<Order>('/checkout/verify-payment/', { provider_payment_id: providerPaymentId }).then((r) => r.data)
  },
  orders(page?: number) {
    return api.get<{ count: number; results: Order[] }>('/orders/', { params: page ? { page } : undefined }).then((r) => r.data)
  },
  order(id: number) {
    return api.get<Order>(`/orders/${id}/`).then((r) => r.data)
  },
  cancelOrder(id: number) {
    return api.post<Order>(`/orders/${id}/cancel/`).then((r) => r.data)
  },
}

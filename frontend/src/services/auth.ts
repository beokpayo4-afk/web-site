import axios from 'axios'

import { api } from '@/lib/api'
import { tokenStore } from '@/lib/tokenStore'
import type { Address, AuthResponse, Profile } from '@/types/api'

function isNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404
}

export const authService = {
  async register(payload: { email: string; password: string; full_name: string; phone?: string }) {
    const { data } = await api.post<AuthResponse>('/auth/register/', payload)
    tokenStore.set(data.access, data.refresh)
    return data
  },
  async login(payload: { email: string; password: string }) {
    const { data } = await api.post<AuthResponse>('/auth/login/', payload)
    tokenStore.set(data.access, data.refresh)
    return data
  },
  async logout() {
    const refresh = tokenStore.getRefresh()
    try {
      if (refresh) await api.post('/auth/logout/', { refresh })
    } finally {
      tokenStore.clear()
    }
  },
  me() {
    return api.get<Profile>('/auth/me/').then((r) => r.data)
  },
  async updateMe(payload: Partial<Profile>) {
    try {
      const { data } = await api.patch<Profile>('/auth/profile/', payload)
      return data
    } catch (error) {
      if (!isNotFound(error)) throw error
      const { data } = await api.patch<Profile>('/auth/me/', payload)
      return data
    }
  },
  async changePassword(payload: { current_password: string; new_password: string }) {
    try {
      const { data } = await api.post<{ detail: string; access: string; refresh: string }>('/auth/change-password/', payload)
      tokenStore.set(data.access, data.refresh)
      return data
    } catch (error) {
      if (!isNotFound(error)) throw error
      const { data } = await api.post<{ detail: string; access: string; refresh: string }>('/auth/password/change/', payload)
      tokenStore.set(data.access, data.refresh)
      return data
    }
  },
  forgotPassword(email: string) {
    return api.post('/auth/forgot-password/', { email }).then((r) => r.data)
  },
  resetPassword(payload: { uid: string; token: string; new_password: string }) {
    return api.post('/auth/reset-password/', payload).then((r) => r.data)
  },
  addresses() {
    return api.get<Address[]>('/auth/addresses/').then((r) => r.data)
  },
  createAddress(payload: Partial<Address>) {
    return api.post<Address>('/auth/addresses/', payload).then((r) => r.data)
  },
  updateAddress(id: number, payload: Partial<Address>) {
    return api.patch<Address>(`/auth/addresses/${id}/`, payload).then((r) => r.data)
  },
  deleteAddress(id: number) {
    return api.delete(`/auth/addresses/${id}/`)
  },
}

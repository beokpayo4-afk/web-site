import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { notifyAuthExpired } from '@/lib/authEvents'
import { tokenStore } from '@/lib/tokenStore'
import type { ApiError } from '@/types/api'

/** Backend origin (no path). Set VITE_API_URL in Vercel / frontend/.env for production. */
export function getApiRoot(): string {
  return (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8001').replace(/\/+$/, '')
}

/** Django REST API base — all existing services use paths relative to /api/v1/. */
const API_BASE = `${getApiRoot()}/api/v1`

const AUTH_NO_REFRESH = ['/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/forgot-password/', '/auth/reset-password/']

type RetryConfig = InternalAxiosRequestConfig & { __retried?: boolean }

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken() {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return null
  const { data } = await axios.post<{ access: string; refresh?: string }>(`${API_BASE}/auth/refresh/`, { refresh })
  tokenStore.set(data.access, data.refresh)
  return data.access
}

function shouldAttemptRefresh(config?: RetryConfig) {
  if (!config || config.__retried) return false
  const path = config.url ?? ''
  return !AUTH_NO_REFRESH.some((fragment) => path.includes(fragment))
}

api.interceptors.request.use(async (config) => {
  let token = tokenStore.getValidAccess()
  if (!token && tokenStore.getRefresh() && shouldAttemptRefresh(config as RetryConfig)) {
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      token = await refreshPromise
    } catch {
      tokenStore.clear()
      notifyAuthExpired()
      token = null
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as RetryConfig | undefined
    if (error.response?.status === 401 && original && shouldAttemptRefresh(original)) {
      original.__retried = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const access = await refreshPromise
        if (!access) {
          tokenStore.clear()
          notifyAuthExpired()
          return Promise.reject(error)
        }
        original.headers = AxiosHeaders.from(original.headers ?? {})
        original.headers.set('Authorization', `Bearer ${access}`)
        return api.request(original)
      } catch {
        tokenStore.clear()
        notifyAuthExpired()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

function flattenDetails(details: unknown): string[] {
  if (!details) return []
  if (typeof details === 'string') return [details]
  if (Array.isArray(details)) return details.flatMap((item) => flattenDetails(item))
  if (typeof details === 'object') {
    return Object.values(details as Record<string, unknown>).flatMap((value) => flattenDetails(value))
  }
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data
    if (typeof data === 'string') {
      if (status === 401) return 'Invalid credentials. Check your email and password.'
      if (status === 403) return 'You do not have permission to do that.'
      if (status === 404) return 'That request could not be found. Refresh and try again.'
      return fallback
    }
    if (!isRecord(data)) {
      if (status === 401) return 'Invalid credentials. Check your email and password.'
      if (status === 403) return 'You do not have permission to do that.'
      return fallback
    }
    if (status === 401) {
      const message =
        isRecord(data.error) && typeof data.error.message === 'string'
          ? data.error.message
          : typeof data.detail === 'string'
            ? data.detail
            : ''
      return message || 'Invalid credentials. Check your email and password.'
    }
    if (status === 403) {
      return 'You do not have permission to do that.'
    }
    if (isRecord(data.error)) {
      const fieldErrors = flattenDetails(data.error.details)
      if (fieldErrors.length) return fieldErrors.join(' ')
      if (typeof data.error.message === 'string' && data.error.message !== 'Request could not be completed.') {
        return data.error.message
      }
    }
    if (data.detail) return String(data.detail)
  }
  return fallback
}

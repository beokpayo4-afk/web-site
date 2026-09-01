const ACCESS_KEY = 'nexora.access'
const REFRESH_KEY = 'nexora.refresh'

function tokenExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(json) as { exp?: number }
    return typeof data.exp === 'number' ? data.exp * 1000 : null
  } catch {
    return null
  }
}

export const tokenStore = {
  getAccess() {
    return sessionStorage.getItem(ACCESS_KEY)
  },
  /** Access token only if still usable (30s clock skew). */
  getValidAccess() {
    const token = sessionStorage.getItem(ACCESS_KEY)
    if (!token) return null
    const exp = tokenExpMs(token)
    if (exp != null && exp <= Date.now() + 30_000) {
      sessionStorage.removeItem(ACCESS_KEY)
      return null
    }
    return token
  },
  getRefresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh?: string) {
    sessionStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    sessionStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

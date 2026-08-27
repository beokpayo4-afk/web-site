const ACCESS_KEY = 'nexora.access'
const REFRESH_KEY = 'nexora.refresh'

export const tokenStore = {
  getAccess() {
    return sessionStorage.getItem(ACCESS_KEY)
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

export const AUTH_EXPIRED_EVENT = 'nexora:auth-expired'

export function notifyAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

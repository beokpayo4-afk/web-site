import { createContext, useContext } from 'react'

export interface AdminToastContextValue {
  push: (message: string, tone?: 'success' | 'error') => void
}

export const AdminToastContext = createContext<AdminToastContextValue | null>(null)

export function useAdminToast() {
  const ctx = useContext(AdminToastContext)
  if (!ctx) throw new Error('useAdminToast must be used within AdminToastProvider')
  return ctx
}

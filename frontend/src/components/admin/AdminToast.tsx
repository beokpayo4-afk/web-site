import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { AdminToastContext } from '@/hooks/admin-toast-context'

type Toast = { id: number; message: string; tone: 'success' | 'error' }

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl px-4 py-3 text-sm text-white shadow-lg ${item.tone === 'error' ? 'bg-red-700' : 'bg-pine'}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  )
}

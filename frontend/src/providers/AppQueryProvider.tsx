import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useMemo } from 'react'

import { makeQueryClient } from '@/lib/queryClient'

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => makeQueryClient(), [])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

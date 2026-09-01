import { useQuery } from '@tanstack/react-query'

import { healthService } from '@/services/health'

export function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: healthService.check,
    retry: 1,
  })

  if (health.isLoading) {
    return <p className="text-sm text-ink-soft">Checking API…</p>
  }

  if (health.data?.status === 'ok') {
    return <p className="text-sm text-good">API status: ok</p>
  }

  return <p className="text-sm text-red-700">API is unreachable. Check that the backend is running and VITE_API_URL is set correctly.</p>
}

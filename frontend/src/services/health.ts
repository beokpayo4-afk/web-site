import { api } from '@/lib/api'

export interface HealthResponse {
  status: string
}

export const healthService = {
  check() {
    return api.get<HealthResponse>('/health/').then((response) => response.data)
  },
}

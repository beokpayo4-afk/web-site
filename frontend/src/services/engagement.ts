import { api } from '@/lib/api'
import type { NotificationItem, Paginated } from '@/types/api'

export const engagementService = {
  notifications() {
    return api.get<Paginated<NotificationItem>>('/notifications/').then((r) => r.data)
  },
  markRead(id: number) {
    return api.post(`/notifications/${id}/read/`).then((r) => r.data)
  },
  contact(payload: { name: string; email: string; subject: string; message: string }) {
    return api.post('/contact/', payload).then((r) => r.data)
  },
}

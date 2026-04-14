import { apiClient } from './client'
import type { Notification } from '../types'

export const notificationsApi = {
  getAll: () =>
    apiClient.get<Notification[]>('/notifications').then((r) => r.data),

  getUnread: () =>
    apiClient.get<Notification[]>('/notifications/unread').then((r) => r.data),

  countUnread: () =>
    apiClient.get<{ count: number }>('/notifications/unread/count').then((r) => r.data.count),

  markRead: (notificationId: string) =>
    apiClient.patch<Notification>(`/notifications/${notificationId}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post('/notifications/read-all'),
}

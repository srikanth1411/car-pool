import { apiClient } from './client'
import type { RidePreference, Ride } from '../types'

export const preferencesApi = {
  save: (data: {
    tag: string
    groupId: string
    originLocationId: string
    destinationLocationId: string
    intermediateLocationIds?: string[]
    totalSeats: number
    price?: number
    notes?: string
  }) => apiClient.post<RidePreference>('/preferences', data).then((r) => r.data),

  getMyPreferences: () =>
    apiClient.get<RidePreference[]>('/preferences').then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/preferences/${id}`),

  postFromPreference: (id: string, departureTime: string) =>
    apiClient.post<Ride>(`/preferences/${id}/post`, { departureTime }).then((r) => r.data),
}

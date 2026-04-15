import { apiClient } from './client'
import type { RideMessage, User } from '../types'

export const chatApi = {
  getMessages: (rideId: string) =>
    apiClient.get<RideMessage[]>(`/rides/${rideId}/chat`).then((r) => r.data),

  sendMessage: (rideId: string, content: string, mentionedUserIds: string[]) =>
    apiClient.post<RideMessage>(`/rides/${rideId}/chat`, { content, mentionedUserIds }).then((r) => r.data),

  getParticipants: (rideId: string) =>
    apiClient.get<User[]>(`/rides/${rideId}/chat/participants`).then((r) => r.data),
}

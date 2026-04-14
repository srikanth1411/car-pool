import { apiClient } from './client'
import type { Ride, RideRequest } from '../types'

export const ridesApi = {
  create: (data: {
    groupId: string
    originLocationId: string
    destinationLocationId: string
    intermediateLocationIds?: string[]
    departureTime: string
    totalSeats: number
    notes?: string
    price?: number
  }) => apiClient.post<Ride>('/rides', data).then((r) => r.data),

  getGroupRides: (groupId: string) =>
    apiClient.get<Ride[]>(`/rides/group/${groupId}`).then((r) => r.data),

  getMyRides: () =>
    apiClient.get<Ride[]>('/rides/me').then((r) => r.data),

  getAllGroupRides: () =>
    apiClient.get<Ride[]>('/rides/groups').then((r) => r.data),

  getBookedRides: () =>
    apiClient.get<Ride[]>('/rides/booked').then((r) => r.data),

  getRide: (rideId: string) =>
    apiClient.get<Ride>(`/rides/${rideId}`).then((r) => r.data),

  startRide: (rideId: string) =>
    apiClient.post<Ride>(`/rides/${rideId}/start`).then((r) => r.data),

  completeRide: (rideId: string) =>
    apiClient.post<Ride>(`/rides/${rideId}/complete`).then((r) => r.data),

  cancelBooking: (rideId: string) =>
    apiClient.delete(`/rides/${rideId}/request`),

  cancelRide: (rideId: string) =>
    apiClient.delete<Ride>(`/rides/${rideId}`).then((r) => r.data),

  requestSeat: (rideId: string, seatsRequested: number, pickupLocationId: string, dropoffLocationId: string, message?: string) =>
    apiClient.post<RideRequest>(`/rides/${rideId}/request`, { seatsRequested, pickupLocationId, dropoffLocationId, message }).then((r) => r.data),

  getRideRequests: (rideId: string) =>
    apiClient.get<RideRequest[]>(`/rides/${rideId}/requests`).then((r) => r.data),

  confirmRequest: (requestId: string) =>
    apiClient.post<RideRequest>(`/rides/requests/${requestId}/confirm`).then((r) => r.data),

  declineRequest: (requestId: string) =>
    apiClient.post<RideRequest>(`/rides/requests/${requestId}/decline`).then((r) => r.data),
}

import { apiClient } from './client'
import type { Payment, PaymentOrder, Wallet } from '../types'

export const paymentsApi = {
  createOrder: (rideId: string) =>
    apiClient.post<PaymentOrder>('/payments/orders', { rideId }).then((r) => r.data),

  getPaymentStatus: (rideId: string) =>
    apiClient.get<Payment>(`/payments/ride/${rideId}/status`).then((r) => r.data),

  getWallet: () =>
    apiClient.get<Wallet>('/payments/wallet').then((r) => r.data),
}

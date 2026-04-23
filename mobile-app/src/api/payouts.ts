import { apiClient } from './client'

export interface BankAccount {
  accountHolderName?: string
  accountNumber?: string   // masked
  ifscCode?: string
  bankName?: string
}

export interface Settlement {
  settlementId?: string
  status?: string          // PENDING | SUCCESS | FAILED
  amount?: number
  cfTransferId?: string
  failureReason?: string
  createdAt?: string
  accountHolderName?: string
  accountNumber?: string
  ifscCode?: string
  bankName?: string
}

export const payoutsApi = {
  getBankAccount: () =>
    apiClient.get<Settlement>('/payouts/bank-account').then(r => r.data),

  saveBankAccount: (data: { accountHolderName: string; accountNumber: string; ifscCode: string; bankName?: string }) =>
    apiClient.post<Settlement>('/payouts/bank-account', data).then(r => r.data),

  settleNow: () =>
    apiClient.post<Settlement>('/payouts/settle').then(r => r.data),

  getHistory: () =>
    apiClient.get<Settlement[]>('/payouts/history').then(r => r.data),
}

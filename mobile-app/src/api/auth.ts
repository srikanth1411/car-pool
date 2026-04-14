import { apiClient } from './client'
import type { AuthResponse } from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then(r => r.data),

  register: (name: string, email: string, password: string, canDrive: boolean) =>
    apiClient.post<AuthResponse>('/auth/register', { name, email, password, canDrive }).then(r => r.data),
}

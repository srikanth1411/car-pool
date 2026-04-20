import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ApiError } from '../types'

// iOS Simulator can use localhost; Android emulator use 10.0.2.2; physical device use your Mac's LAN IP
export const API_BASE_URL = 'http://192.168.31.214:8080/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user'])
      // Lazy require avoids circular dep (authStore → auth → client)
      // Setting isAuthenticated:false causes _layout.tsx to redirect to login automatically
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('../store/authStore')
      useAuthStore.setState({ user: null, isAuthenticated: false })
    }
    return Promise.reject(error)
  }
)

export function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as ApiError | undefined
    if (data?.fieldErrors) {
      return Object.values(data.fieldErrors).join(', ')
    }
    return data?.message ?? e.message
  }
  return String(e)
}

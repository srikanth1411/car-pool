import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from '../types'
import { authApi } from '../api/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hydrated: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, canDrive: boolean) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hydrated: false,

  hydrate: async () => {
    const [token, userJson] = await AsyncStorage.multiGet(['accessToken', 'user'])
    const accessToken = token[1]
    const user = userJson[1] ? JSON.parse(userJson[1]) : null
    set({ isAuthenticated: !!accessToken, user, hydrated: true })
  },

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const res = await authApi.login(email, password)
      await AsyncStorage.multiSet([
        ['accessToken', res.accessToken],
        ['refreshToken', res.refreshToken],
        ['user', JSON.stringify(res.user)],
      ])
      set({ user: res.user, isAuthenticated: true, isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  register: async (name, email, password, canDrive) => {
    set({ isLoading: true })
    try {
      const res = await authApi.register(name, email, password, canDrive)
      await AsyncStorage.multiSet([
        ['accessToken', res.accessToken],
        ['refreshToken', res.refreshToken],
        ['user', JSON.stringify(res.user)],
      ])
      set({ user: res.user, isAuthenticated: true, isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user'])
    set({ user: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))

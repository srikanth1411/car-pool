import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'

export default function RootLayout() {
  const { isAuthenticated, hydrated, hydrate } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    hydrate()
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, hydrated, segments])

  if (!hydrated) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="groups/[groupId]" options={{ headerShown: true, title: 'Group', headerBackTitle: 'Groups' }} />
      <Stack.Screen name="groups/application/[membershipId]" options={{ headerShown: true, title: 'Application', headerBackTitle: 'Back' }} />
      <Stack.Screen name="rides/[rideId]" options={{ headerShown: true, title: 'Ride Details', headerBackTitle: 'Rides' }} />
      <Stack.Screen name="rides/new" options={{ headerShown: true, title: 'Post a Ride', headerBackTitle: 'Back' }} />
      <Stack.Screen name="preferences/index" options={{ headerShown: true, title: 'Preferences', headerBackTitle: 'Back' }} />
    </Stack>
  )
}

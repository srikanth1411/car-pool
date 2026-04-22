import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, AppState,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ridesApi } from '../../src/api/rides'
import { useAuthStore } from '../../src/store/authStore'
import type { Ride } from '../../src/types'

function RideStatusBadge({ status }: { status: Ride['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    OPEN:      { bg: '#dcfce7', text: '#16a34a' },
    FULL:      { bg: '#fef9c3', text: '#ca8a04' },
    DEPARTED:  { bg: '#dbeafe', text: '#2563eb' },
    COMPLETED: { bg: '#f3f4f6', text: '#6b7280' },
    CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
  }
  const c = colors[status] ?? colors.OPEN
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type Tab = 'browse' | 'booked' | 'driving'

export default function RidesScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [allRides, setAllRides] = useState<Ride[]>([])
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set())
  const [drivingIds, setDrivingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('browse')

  const loadRides = useCallback(() => {
    Promise.all([
      ridesApi.getAllGroupRides(),
      ridesApi.getBookedRides(),
      user?.canDrive ? ridesApi.getMyRides() : Promise.resolve([]),
    ]).then(([all, booked, driving]) => {
      setAllRides(all)
      setBookedIds(new Set(booked.map(r => r.id)))
      setDrivingIds(new Set(driving.map(r => r.id)))
    }).finally(() => setLoading(false))
  }, [user])

  useEffect(() => { loadRides() }, [loadRides])

  // Refresh when app comes back to foreground (e.g. driver completed ride)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') loadRides()
    })
    return () => sub.remove()
  }, [loadRides])

  const browsable = useMemo(() =>
    allRides.filter(r => r.status === 'OPEN' && r.availableSeats > 0 && !drivingIds.has(r.id) && !bookedIds.has(r.id)),
    [allRides, drivingIds, bookedIds])

  const booked = useMemo(() => allRides.filter(r => bookedIds.has(r.id)), [allRides, bookedIds])
  const driving = useMemo(() => allRides.filter(r => drivingIds.has(r.id)), [allRides, drivingIds])

  const displayed = activeTab === 'browse' ? browsable : activeTab === 'booked' ? booked : driving

  const tabs: { key: Tab; label: string }[] = [
    { key: 'browse', label: `Browse (${browsable.length})` },
    { key: 'booked', label: `Booked (${bookedIds.size})` },
    ...(user?.canDrive ? [{ key: 'driving' as Tab, label: `Driving (${drivingIds.size})` }] : []),
  ]

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : displayed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>
            {activeTab === 'browse' ? 'No open rides to book' :
             activeTab === 'booked' ? 'No booked rides' : 'No rides posted yet'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {displayed.map(ride => (
            <TouchableOpacity key={ride.id} style={styles.card} onPress={() => router.push(`/rides/${ride.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.route} numberOfLines={1}>{ride.origin} → {ride.destination}</Text>
                <RideStatusBadge status={ride.status} />
              </View>
              <Text style={styles.time}>{formatTime(ride.departureTime)}</Text>
              <View style={styles.cardRow}>
                <View style={styles.row}>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{ride.groupName}</Text>
                  </View>
                  {drivingIds.has(ride.id) && (
                    <View style={styles.greenBadge}><Text style={styles.greenBadgeText}>Driving</Text></View>
                  )}
                  {bookedIds.has(ride.id) && !drivingIds.has(ride.id) && (
                    <View style={styles.greenBadge}><Text style={styles.greenBadgeText}>Booked</Text></View>
                  )}
                </View>
                <View style={styles.row}>
                  {ride.price != null && <Text style={styles.price}>₹{ride.price.toFixed(2)}</Text>}
                  <Text style={styles.seats}>{ride.availableSeats}/{ride.totalSeats} seats</Text>
                </View>
              </View>
              <Text style={styles.driver}>Driver: {ride.driver.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 6,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6',
  },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  list: { padding: 14, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  route: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  groupBadgeText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  greenBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  greenBadgeText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  price: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  seats: { fontSize: 12, color: '#6b7280' },
  driver: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
})

import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { groupsApi } from '../../src/api/groups'
import { ridesApi } from '../../src/api/rides'
import { useAuthStore } from '../../src/store/authStore'
import type { Group, Ride, Membership } from '../../src/types'

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

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [pendingRequests, setPendingRequests] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [grps, booked, driving, pending] = await Promise.all([
        groupsApi.getMyGroups(),
        ridesApi.getBookedRides(),
        user?.canDrive ? ridesApi.getMyRides() : Promise.resolve([]),
        groupsApi.getMyPendingRequests(),
      ])
      setPendingRequests(pending)
      setGroups(grps)
      const allMyRides = [...booked, ...driving].filter(
        (r, i, arr) => arr.findIndex(x => x.id === r.id) === i
      )
      setCurrentRide(allMyRides.find(r => r.status === 'DEPARTED') ?? null)
      setUpcomingRides(
        allMyRides
          .filter(r => r.status === 'OPEN' || r.status === 'FULL')
          .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const handleStart = async (rideId: string) => {
    try {
      await ridesApi.startRide(rideId)
      await load()
    } catch {
      Alert.alert('Error', 'Could not start ride')
    }
  }

  const handleComplete = async (rideId: string) => {
    try {
      await ridesApi.completeRide(rideId)
      setCurrentRide(null)
    } catch {
      Alert.alert('Error', 'Could not complete ride')
    }
  }

  const subtitle = loading ? 'Loading…'
    : currentRide ? 'You have a ride in progress'
    : upcomingRides.length > 0 ? `You have ${upcomingRides.length} upcoming ride${upcomingRides.length > 1 ? 's' : ''}`
    : 'No upcoming rides yet'

  const canPostRide = user?.canDrive && !currentRide && upcomingRides.length === 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.headerSub}>{subtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          {user?.canDrive && (
            <TouchableOpacity
              style={[styles.postBtn, !canPostRide && styles.postBtnDisabled]}
              onPress={() => canPostRide && router.push('/rides/new')}
              disabled={!canPostRide}
            >
              <Text style={styles.postBtnText}>+ Post Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <>
          {/* Groups pill */}
          <TouchableOpacity style={styles.groupPill} onPress={() => router.push('/(tabs)/groups')}>
            <Text style={styles.groupPillText}>👥  {groups.length} {groups.length === 1 ? 'group' : 'groups'}</Text>
          </TouchableOpacity>

          {/* Pending group requests */}
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏳ Pending Group Approvals</Text>
              {pendingRequests.map(req => (
                <View key={req.id} style={styles.pendingCard}>
                  <View style={styles.pendingRow}>
                    <Text style={styles.pendingGroupName}>{req.groupName}</Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  </View>
                  <Text style={styles.pendingMeta}>Your join request is awaiting admin approval</Text>
                </View>
              ))}
            </View>
          )}

          {/* Current ride */}
          {currentRide && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🟢 Current Ride</Text>
              <TouchableOpacity style={[styles.card, styles.cardGreen]} onPress={() => router.push(`/rides/${currentRide.id}`)}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardRoute}>{currentRide.origin} → {currentRide.destination}</Text>
                  <RideStatusBadge status={currentRide.status} />
                </View>
                <Text style={styles.cardTime}>{formatTime(currentRide.departureTime)}</Text>
                <Text style={styles.cardGroup}>{currentRide.groupName}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.chatBtn} onPress={() => router.push(`/rides/${currentRide.id}`)}>
                    <Text style={styles.chatBtnText}>💬 Chat</Text>
                  </TouchableOpacity>
                  {currentRide.driver.id === user?.id && (
                    <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(currentRide.id)}>
                      <Text style={styles.completeBtnText}>✅ Complete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Upcoming rides */}
          {upcomingRides.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📅 Upcoming Rides</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/rides')}>
                  <Text style={styles.seeAll}>All rides →</Text>
                </TouchableOpacity>
              </View>
              {upcomingRides.map(ride => (
                <TouchableOpacity key={ride.id} style={styles.card} onPress={() => router.push(`/rides/${ride.id}`)}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardRoute}>{ride.origin} → {ride.destination}</Text>
                    <RideStatusBadge status={ride.status} />
                  </View>
                  <Text style={styles.cardTime}>{formatTime(ride.departureTime)}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardGroup}>{ride.groupName}</Text>
                    {ride.price != null && (
                      <Text style={styles.price}>₹{ride.price.toFixed(2)}</Text>
                    )}
                  </View>
                  {ride.driver.id === user?.id && (
                    <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(ride.id)}>
                      <Text style={styles.startBtnText}>▶ Start Ride</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty state */}
          {!currentRide && upcomingRides.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptySub}>
                {groups.length === 0
                  ? 'Join a group to find available rides near you'
                  : 'Browse available rides in your groups and book a seat'}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push(groups.length === 0 ? '/(tabs)/groups' : '/(tabs)/rides')}
              >
                <Text style={styles.emptyBtnText}>
                  {groups.length === 0 ? 'Browse Groups' : 'Browse Rides'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: '#2563eb', borderRadius: 16, padding: 18, marginBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#bfdbfe', marginTop: 2 },
  headerActions: { gap: 6 },
  postBtn: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  groupPill: {
    alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb',
  },
  groupPillText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  seeAll: { fontSize: 13, color: '#2563eb' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardGreen: { borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardRoute: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  cardTime: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  cardGroup: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  price: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chatBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#86efac', backgroundColor: '#fff',
  },
  chatBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  completeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: '#16a34a',
  },
  completeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  startBtn: {
    marginTop: 10, backgroundColor: '#2563eb', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  pendingCard: {
    backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#fde68a',
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pendingGroupName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  pendingBadge: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#fcd34d' },
  pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#d97706' },
  pendingMeta: { fontSize: 12, color: '#92400e' },
})

import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { groupsApi } from '../../src/api/groups'
import { ridesApi } from '../../src/api/rides'
import { paymentsApi } from '../../src/api/payments'
import { useAuthStore } from '../../src/store/authStore'
import type { Group, Ride, Membership, Payment } from '../../src/types'

const NEWLY_APPROVED_KEY = 'dashboard_newly_approved_groups'
const TRACKED_PENDING_KEY = 'dashboard_tracked_pending_groups'

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
  const [adminPending, setAdminPending] = useState<Membership[]>([])
  const [newlyApproved, setNewlyApproved] = useState<{ groupId: string; groupName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRidePaymentStatus, setCurrentRidePaymentStatus] = useState<string | null>(null)
  const [pendingPayRide, setPendingPayRide] = useState<Ride | null>(null)
  const [driverPendingPayments, setDriverPendingPayments] = useState<{ ride: Ride; unpaidRiders: Payment[] }[]>([])
  const [reminding, setReminding] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [grps, booked, driving, pending, adminPend] = await Promise.all([
        groupsApi.getMyGroups(),
        ridesApi.getBookedRides(),
        user?.canDrive ? ridesApi.getMyRides() : Promise.resolve([]),
        groupsApi.getMyPendingRequests(),
        groupsApi.getAdminPendingRequests(),
      ])

      setGroups(grps)
      setPendingRequests(pending)
      setAdminPending(adminPend)

      // Detect newly approved groups
      const trackedRaw = await AsyncStorage.getItem(TRACKED_PENDING_KEY)
      const tracked: { groupId: string; groupName: string }[] = trackedRaw ? JSON.parse(trackedRaw) : []

      const approvedGroupIds = new Set(grps.map(g => g.id))
      const stillPendingIds = new Set(pending.map(m => m.groupId))

      const justApproved = tracked.filter(
        t => approvedGroupIds.has(t.groupId) && !stillPendingIds.has(t.groupId)
      )

      // Update tracked: only keep still-pending ones + add new ones
      const newTracked = [
        ...tracked.filter(t => stillPendingIds.has(t.groupId)),
        ...pending
          .filter(m => m.groupId && !tracked.some(t => t.groupId === m.groupId))
          .map(m => ({ groupId: m.groupId!, groupName: m.groupName ?? '' })),
      ]
      await AsyncStorage.setItem(TRACKED_PENDING_KEY, JSON.stringify(newTracked))

      // Load and merge with previously stored newly-approved
      const prevApprovedRaw = await AsyncStorage.getItem(NEWLY_APPROVED_KEY)
      const prevApproved: { groupId: string; groupName: string }[] = prevApprovedRaw ? JSON.parse(prevApprovedRaw) : []
      const mergedApproved = [
        ...prevApproved.filter(p => !justApproved.some(j => j.groupId === p.groupId)),
        ...justApproved,
      ]
      await AsyncStorage.setItem(NEWLY_APPROVED_KEY, JSON.stringify(mergedApproved))
      setNewlyApproved(mergedApproved)

      const allMyRides = [...booked, ...driving].filter(
        (r, i, arr) => arr.findIndex(x => x.id === r.id) === i
      )
      const departed = allMyRides.find(r => r.status === 'DEPARTED') ?? null
      setCurrentRide(departed)

      // Fetch payment status for booked riders on the current departed ride
      if (departed && departed.driver.id !== user?.id && departed.price) {
        try {
          const ps = await paymentsApi.getPaymentStatus(departed.id)
          setCurrentRidePaymentStatus(ps.status)
        } catch { setCurrentRidePaymentStatus(null) }
      } else {
        setCurrentRidePaymentStatus(null)
      }

      // Find a COMPLETED ride where rider still owes payment
      const completedRiderRides = allMyRides.filter(
        r => r.status === 'COMPLETED' && r.driver.id !== user?.id && r.price != null
      )
      let foundUnpaid: Ride | null = null
      for (const r of completedRiderRides) {
        try {
          const ps = await paymentsApi.getPaymentStatus(r.id)
          if (ps.status !== 'SUCCESS') { foundUnpaid = r; break }
        } catch {}
      }
      setPendingPayRide(foundUnpaid)

      setUpcomingRides(
        allMyRides
          .filter(r => r.status === 'OPEN' || r.status === 'FULL')
          .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
      )

      // Driver: find completed rides with unpaid riders
      if (user?.canDrive) {
        const completedDriving = driving.filter(r => r.status === 'COMPLETED' && r.price != null)
        const pendingResults: { ride: Ride; unpaidRiders: Payment[] }[] = []
        for (const r of completedDriving) {
          try {
            const statuses = await paymentsApi.getRidePaymentStatuses(r.id)
            const unpaid = statuses.filter(s => s.status !== 'SUCCESS' && s.status !== 'NOT_REQUIRED')
            if (unpaid.length > 0) pendingResults.push({ ride: r, unpaidRiders: unpaid })
          } catch {}
        }
        setDriverPendingPayments(pendingResults)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const dismissApproved = async (groupId: string) => {
    const updated = newlyApproved.filter(n => n.groupId !== groupId)
    setNewlyApproved(updated)
    await AsyncStorage.setItem(NEWLY_APPROVED_KEY, JSON.stringify(updated))
  }

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

  const handlePayNow = (rideId: string) => {
    router.push({ pathname: `/rides/${rideId}`, params: { pay: '1' } })
  }

  const handleRemind = async (rideId: string) => {
    setReminding(rideId)
    try {
      await paymentsApi.remindPendingPayments(rideId)
      Alert.alert('Reminders Sent', 'Unpaid riders have been notified to complete their payment.')
    } catch {
      Alert.alert('Error', 'Could not send reminders. Please try again.')
    } finally {
      setReminding(null)
    }
  }

  const subtitle = loading ? 'Loading…'
    : currentRide ? 'You have a ride in progress'
    : upcomingRides.length > 0 ? `You have ${upcomingRides.length} upcoming ride${upcomingRides.length > 1 ? 's' : ''}`
    : 'No upcoming rides yet'

  const canPostRide = user?.canDrive && !currentRide && upcomingRides.length === 0

  // Group admin pending by group for display
  const adminPendingByGroup = adminPending.reduce<Record<string, { groupId: string; groupName: string; count: number }>>(
    (acc, m) => {
      const gid = m.groupId ?? ''
      if (!acc[gid]) acc[gid] = { groupId: gid, groupName: m.groupName ?? '', count: 0 }
      acc[gid].count++
      return acc
    },
    {}
  )

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

          {/* ── Newly approved ── */}
          {newlyApproved.length > 0 && (
            <View style={styles.section}>
              {newlyApproved.map(n => (
                <View key={n.groupId} style={styles.approvedCard}>
                  <View style={styles.approvedRow}>
                    <Text style={styles.approvedIcon}>🎉</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.approvedTitle}>You're in!</Text>
                      <Text style={styles.approvedBody}>
                        Your request to join <Text style={{ fontWeight: '700' }}>{n.groupName}</Text> was approved.
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => dismissApproved(n.groupId)} style={styles.dismissBtn}>
                      <Text style={styles.dismissText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.approvedViewBtn}
                    onPress={() => {
                      dismissApproved(n.groupId)
                      router.push('/(tabs)/groups')
                    }}
                  >
                    <Text style={styles.approvedViewBtnText}>View group →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* ── Admin: pending approvals ── */}
          {Object.values(adminPendingByGroup).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Pending Approvals</Text>
              {Object.values(adminPendingByGroup).map(g => (
                <TouchableOpacity
                  key={g.groupId}
                  style={styles.adminPendingCard}
                  onPress={() => router.push(`/groups/${g.groupId}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminPendingGroup}>{g.groupName}</Text>
                    <Text style={styles.adminPendingMeta}>
                      {g.count} member request{g.count !== 1 ? 's' : ''} awaiting your approval
                    </Text>
                  </View>
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>{g.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Rider: pending group requests ── */}
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏳ Your Group Requests</Text>
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

          {/* ── Current ride ── */}
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
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => router.push(`/rides/chat/${currentRide.id}`)}
                  >
                    <Text style={styles.chatBtnText}>💬 Chat</Text>
                  </TouchableOpacity>
                  {currentRide.driver.id === user?.id ? (
                    <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(currentRide.id)}>
                      <Text style={styles.completeBtnText}>✅ Complete</Text>
                    </TouchableOpacity>
                  ) : currentRide.price != null && currentRidePaymentStatus !== 'SUCCESS' ? (
                    <TouchableOpacity style={styles.payBtn} onPress={() => handlePayNow(currentRide.id)}>
                      <Text style={styles.payBtnText}>💳 Pay ₹{currentRide.price.toFixed(2)}</Text>
                    </TouchableOpacity>
                  ) : currentRidePaymentStatus === 'SUCCESS' ? (
                    <View style={styles.paidPill}>
                      <Text style={styles.paidText}>✅ Paid</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Pending payment for completed ride ── */}
          {pendingPayRide && (
            <View style={styles.section}>
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#7c3aed' }]}>
                <View style={styles.cardRow}>
                  <Text style={[styles.cardRoute, { fontSize: 13 }]}>{pendingPayRide.origin} → {pendingPayRide.destination}</Text>
                  <RideStatusBadge status={pendingPayRide.status} />
                </View>
                <Text style={[styles.cardTime, { marginBottom: 10 }]}>Payment due for completed ride</Text>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => router.push({ pathname: `/rides/${pendingPayRide.id}`, params: { pay: '1' } })}
                >
                  <Text style={styles.payBtnText}>💳 Pay ₹{pendingPayRide.price!.toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Driver: completed rides with pending payments ── */}
          {driverPendingPayments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Pending Payments</Text>
              {driverPendingPayments.map(({ ride, unpaidRiders }) => (
                <View key={ride.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardRoute}>{ride.origin} → {ride.destination}</Text>
                    <RideStatusBadge status={ride.status} />
                  </View>
                  <Text style={styles.cardTime}>{unpaidRiders.length} rider{unpaidRiders.length > 1 ? 's' : ''} yet to pay · ₹{ride.price?.toFixed(2)} each</Text>
                  <Text style={[styles.cardGroup, { marginBottom: 10 }]}>
                    {unpaidRiders.map(r => r.riderName).join(', ')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.remindBtn, reminding === ride.id && styles.remindBtnDisabled]}
                    onPress={() => handleRemind(ride.id)}
                    disabled={reminding === ride.id}
                  >
                    {reminding === ride.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.remindBtnText}>🔔 Remind Riders</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* ── Upcoming rides ── */}
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

          {/* ── Empty state ── */}
          {!currentRide && upcomingRides.length === 0 && pendingRequests.length === 0 && newlyApproved.length === 0 && (
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

  // Newly approved
  approvedCard: {
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#86efac',
  },
  approvedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  approvedIcon: { fontSize: 24 },
  approvedTitle: { fontSize: 15, fontWeight: '700', color: '#15803d' },
  approvedBody: { fontSize: 13, color: '#166534', marginTop: 2, lineHeight: 18 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 14, color: '#6b7280' },
  approvedViewBtn: {
    backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  approvedViewBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Admin pending
  adminPendingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#fde68a',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  adminPendingGroup: { fontSize: 14, fontWeight: '600', color: '#111827' },
  adminPendingMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  adminBadge: {
    backgroundColor: '#f59e0b', borderRadius: 20, minWidth: 28, height: 28,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  adminBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Rider pending
  pendingCard: {
    backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#fde68a',
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pendingGroupName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  pendingBadge: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#fcd34d' },
  pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#d97706' },
  pendingMeta: { fontSize: 12, color: '#92400e' },

  // Ride cards
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
  payBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: '#7c3aed',
  },
  payBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  paidPill: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
  },
  paidText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  startBtn: {
    marginTop: 10, backgroundColor: '#2563eb', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  remindBtn: {
    backgroundColor: '#f59e0b', borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  remindBtnDisabled: { opacity: 0.5 },
  remindBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})

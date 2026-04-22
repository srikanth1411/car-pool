import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal, SafeAreaView,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ridesApi } from '../../src/api/rides'
import { groupsApi } from '../../src/api/groups'
import { paymentsApi } from '../../src/api/payments'
import { useAuthStore } from '../../src/store/authStore'
import { extractError, API_BASE_URL } from '../../src/api/client'
import type { Ride, RideRequest, GroupLocation, Payment } from '../../src/types'

function formatTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: Ride['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    OPEN:      { bg: '#dcfce7', text: '#16a34a' },
    FULL:      { bg: '#fef9c3', text: '#ca8a04' },
    DEPARTED:  { bg: '#dbeafe', text: '#2563eb' },
    COMPLETED: { bg: '#f3f4f6', text: '#6b7280' },
    CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
  }
  const c = colors[status] ?? colors.OPEN
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

function RequestStatusBadge({ status }: { status: RideRequest['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PENDING:   { bg: '#fef9c3', text: '#ca8a04' },
    CONFIRMED: { bg: '#dcfce7', text: '#16a34a' },
    DECLINED:  { bg: '#fee2e2', text: '#dc2626' },
    CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
  }
  const c = colors[status] ?? colors.PENDING
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

export default function RideDetailScreen() {
  const { rideId, pay } = useLocalSearchParams<{ rideId: string; pay?: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const [ride, setRide] = useState<Ride | null>(null)
  const [requests, setRequests] = useState<RideRequest[]>([])
  const [isBooked, setIsBooked] = useState(false)
  const [locations, setLocations] = useState<GroupLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [requestLoading, setRequestLoading] = useState(false)
  const [showBookModal, setShowBookModal] = useState(false)
  const [seatsRequested, setSeatsRequested] = useState('1')
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [dropoffLocationId, setDropoffLocationId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<Payment | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  const isDriver = ride?.driver.id === user?.id

  const load = async () => {
    if (!rideId) return
    try {
      const r = await ridesApi.getRide(rideId)
      setRide(r)
      if (r.groupId) {
        const locs = await groupsApi.getLocations(r.groupId)
        setLocations(locs)
      }
      if (r.driver.id === user?.id) {
        const reqs = await ridesApi.getRideRequests(rideId)
        setRequests(reqs)
      } else {
        const booked = await ridesApi.getBookedRides()
        const isOnRide = booked.some(b => b.id === rideId)
        setIsBooked(isOnRide)
        // Fetch payment status for booked riders on departed/completed rides
        if (isOnRide && (r.status === 'DEPARTED' || r.status === 'COMPLETED') && r.price) {
          try {
            const ps = await paymentsApi.getPaymentStatus(rideId)
            setPaymentStatus(ps)
          } catch { /* ignore */ }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [rideId])

  // Listen for deep link return from Cashfree (carpool://payment?paymentId=...&status=...)
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('carpool://payment')) return
      const match = url.match(/[?&]paymentId=([^&]+)/)
      const pid = match ? match[1] : null
      const isPaid = url.includes('status=PAID')

      if (!pid || !isPaid) {
        Alert.alert('Payment Not Completed', 'Your payment was not completed. Please try again.')
        return
      }

      paymentsApi.verifyPayment(pid)
        .then(result => {
          if (result.status === 'SUCCESS') {
            Alert.alert('Payment Successful! 🎉', `₹${ride?.price?.toFixed(2)} paid. The driver's wallet has been credited.`)
          } else {
            Alert.alert('Payment Pending', 'Payment not confirmed yet. Please wait a moment and refresh.')
          }
          load()
        })
        .catch(() => {
          Alert.alert('Could Not Verify', 'Payment may have gone through — please check your history before retrying.')
          load()
        })
    })
    return () => sub.remove()
  }, [ride])

  // Auto-open payment when navigated here with ?pay=1
  useEffect(() => {
    if (pay !== '1' || loading || !ride || !isBooked) return
    if (paymentStatus?.status === 'SUCCESS') return
    if (ride.price == null || (ride.status !== 'DEPARTED' && ride.status !== 'COMPLETED')) return
    handlePayNow()
  }, [pay, loading, ride, isBooked, paymentStatus])

  const handleRequestSeat = async () => {
    if (!rideId) return
    setRequestLoading(true)
    setError('')
    try {
      await ridesApi.requestSeat(
        rideId,
        parseInt(seatsRequested) || 1,
        pickupLocationId,
        dropoffLocationId,
        message || undefined,
      )
      setShowBookModal(false)
      Alert.alert('Seat Requested!', 'Your request has been sent to the driver.')
      load()
    } catch (e) {
      setError(extractError(e))
    } finally {
      setRequestLoading(false)
    }
  }

  const handleStart = () => {
    Alert.alert('Start Ride', 'Start this ride? All confirmed passengers will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: async () => {
        try { await ridesApi.startRide(rideId!); load() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handleComplete = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: async () => {
        try { await ridesApi.completeRide(rideId!); load() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handleDropRide = () => {
    Alert.alert('Drop Ride', 'Are you sure you want to cancel your seat? Your booking will be released.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: async () => {
        try { await ridesApi.cancelBooking(rideId!); load() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handleCancelRide = () => {
    Alert.alert('Cancel Ride', 'Cancel this ride? All passengers will be notified.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Cancel Ride', style: 'destructive', onPress: async () => {
        try { await ridesApi.cancelRide(rideId!); load() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handlePayNow = async () => {
    if (!rideId) return
    setPayLoading(true)
    try {
      const order = await paymentsApi.createOrder(rideId)
      const backendBase = API_BASE_URL.replace('/api/v1', '')
      // Open the backend's checkout page in SFSafariViewController (iOS) / Chrome Custom Tab (Android).
      // This is a real browser — the Cashfree SDK works reliably here.
      // After payment, Cashfree → backend /return → carpool:// deep link → Linking listener above.
      const checkoutUrl = `${backendBase}/api/v1/payments/checkout/${order.paymentId}`
      await WebBrowser.openBrowserAsync(checkoutUrl, { dismissButtonStyle: 'cancel' })
    } catch (e) {
      Alert.alert('Payment Error', extractError(e))
    } finally {
      setPayLoading(false)
    }
  }

  const handleConfirmRequest = async (requestId: string) => {
    try { await ridesApi.confirmRequest(requestId); load() }
    catch (e) { Alert.alert('Error', extractError(e)) }
  }

  const handleDeclineRequest = async (requestId: string) => {
    try { await ridesApi.declineRequest(requestId); load() }
    catch (e) { Alert.alert('Error', extractError(e)) }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
  if (!ride) return <View style={s.center}><Text style={s.notFound}>Ride not found</Text></View>

  const canBook = !isDriver && !isBooked && ride.status === 'OPEN' && ride.availableSeats > 0
  const allStops = ride.allStops ?? []

  return (
    <KeyboardAwareScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" enableOnAndroid>
      {/* Header card */}
      <View style={s.card}>
        <View style={s.headerRow}>
          <Text style={s.route}>{ride.origin} → {ride.destination}</Text>
          <StatusBadge status={ride.status} />
        </View>
        <Text style={s.time}>🕐  {formatTime(ride.departureTime)}</Text>
        <Text style={s.group}>📍  {ride.groupName}</Text>

        {allStops.length > 0 && (
          <View style={s.stopsBox}>
            <Text style={s.stopsLabel}>Stops:</Text>
            {allStops.map((stop, i) => (
              <Text key={stop.id} style={s.stopItem}>{i + 1}. {stop.name}</Text>
            ))}
          </View>
        )}

        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Seats available</Text>
            <Text style={s.metaValue}>{ride.availableSeats}/{ride.totalSeats}</Text>
          </View>
          {ride.price != null && (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Price</Text>
              <Text style={[s.metaValue, { color: '#16a34a' }]}>₹{ride.price.toFixed(2)}</Text>
            </View>
          )}
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Driver</Text>
            <Text style={s.metaValue}>{ride.driver.name}</Text>
          </View>
        </View>

        {ride.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notes}>{ride.notes}</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        {isDriver && ride.status === 'OPEN' && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleStart}>
            <Text style={s.primaryBtnText}>▶ Start Ride</Text>
          </TouchableOpacity>
        )}
        {isDriver && ride.status === 'DEPARTED' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#16a34a' }]} onPress={handleComplete}>
            <Text style={s.primaryBtnText}>✅ Complete Ride</Text>
          </TouchableOpacity>
        )}
        {ride.status === 'DEPARTED' && (
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: '#0f172a' }]}
            onPress={() => router.push(`/rides/chat/${rideId}`)}
          >
            <Text style={s.primaryBtnText}>💬 Ride Chat</Text>
          </TouchableOpacity>
        )}
        {isDriver && (ride.status === 'OPEN' || ride.status === 'FULL') && (
          <TouchableOpacity style={s.dangerBtn} onPress={handleCancelRide}>
            <Text style={s.dangerBtnText}>🚫 Cancel Ride</Text>
          </TouchableOpacity>
        )}
        {canBook && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => setShowBookModal(true)}>
            <Text style={s.primaryBtnText}>Request Seat</Text>
          </TouchableOpacity>
        )}
        {isBooked && (ride.status === 'OPEN' || ride.status === 'FULL') && (
          <TouchableOpacity style={s.dangerBtn} onPress={handleDropRide}>
            <Text style={s.dangerBtnText}>Drop Ride</Text>
          </TouchableOpacity>
        )}
        {isBooked && <View style={s.bookedPill}><Text style={s.bookedText}>✓ You're booked on this ride</Text></View>}

        {/* Pay Now — shown for booked riders once ride is DEPARTED and price is set */}
        {isBooked && ride.price != null && (ride.status === 'DEPARTED' || ride.status === 'COMPLETED') && (
          paymentStatus?.status === 'SUCCESS' ? (
            <View style={s.paidPill}>
              <Text style={s.paidText}>✅ Payment Complete — ₹{ride.price.toFixed(2)}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.payBtn, payLoading && { opacity: 0.6 }]}
              onPress={handlePayNow}
              disabled={payLoading}
            >
              {payLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.payBtnText}>💳 Pay ₹{ride.price.toFixed(2)}</Text>
              }
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Ride requests (driver view) */}
      {isDriver && requests.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Seat Requests ({requests.length})</Text>
          {requests.map(req => (
            <View key={req.id} style={s.reqCard}>
              <View style={s.reqHeader}>
                <Text style={s.reqName}>{req.rider.name}</Text>
                <RequestStatusBadge status={req.status} />
              </View>
              <Text style={s.reqMeta}>{req.seatsRequested} seat{req.seatsRequested > 1 ? 's' : ''}</Text>
              {req.message && <Text style={s.reqMsg}>"{req.message}"</Text>}
              {req.status === 'PENDING' && (
                <View style={s.reqActions}>
                  <TouchableOpacity style={s.confirmBtn} onPress={() => handleConfirmRequest(req.id)}>
                    <Text style={s.confirmBtnText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn} onPress={() => handleDeclineRequest(req.id)}>
                    <Text style={s.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Book seat modal */}
      <Modal visible={showBookModal} animationType="slide" transparent onRequestClose={() => setShowBookModal(false)}>
        <View style={{ flex: 1 }}>
        <View style={modal.overlay}>
          <KeyboardAwareScrollView style={modal.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" enableOnAndroid>
            <Text style={modal.title}>Request a Seat</Text>

            <Text style={modal.label}>Seats needed</Text>
            <TextInput
              style={modal.input}
              keyboardType="number-pad"
              value={seatsRequested}
              onChangeText={setSeatsRequested}
            />

            {locations.length > 0 && (
              <>
                <Text style={modal.label}>Pickup stop</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[modal.pill, !pickupLocationId && modal.pillActive]}
                      onPress={() => setPickupLocationId('')}
                    >
                      <Text style={[modal.pillText, !pickupLocationId && modal.pillTextActive]}>Any</Text>
                    </TouchableOpacity>
                    {locations.map(loc => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[modal.pill, pickupLocationId === loc.id && modal.pillActive]}
                        onPress={() => setPickupLocationId(loc.id)}
                      >
                        <Text style={[modal.pillText, pickupLocationId === loc.id && modal.pillTextActive]}>{loc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={modal.label}>Dropoff stop</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[modal.pill, !dropoffLocationId && modal.pillActive]}
                      onPress={() => setDropoffLocationId('')}
                    >
                      <Text style={[modal.pillText, !dropoffLocationId && modal.pillTextActive]}>Any</Text>
                    </TouchableOpacity>
                    {locations.map(loc => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[modal.pill, dropoffLocationId === loc.id && modal.pillActive]}
                        onPress={() => setDropoffLocationId(loc.id)}
                      >
                        <Text style={[modal.pillText, dropoffLocationId === loc.id && modal.pillTextActive]}>{loc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={modal.label}>Message (optional)</Text>
            <TextInput
              style={[modal.input, { height: 64, textAlignVertical: 'top' }]}
              placeholder="Any message to the driver…"
              multiline
              value={message}
              onChangeText={setMessage}
            />

            {!!error && <Text style={modal.error}>{error}</Text>}

            <View style={modal.actions}>
              <TouchableOpacity style={modal.cancelBtn} onPress={() => setShowBookModal(false)}>
                <Text style={modal.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modal.submitBtn} onPress={handleRequestSeat} disabled={requestLoading}>
                {requestLoading ? <ActivityIndicator color="#fff" /> : <Text style={modal.submitText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#6b7280', fontSize: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  route: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  time: { fontSize: 14, color: '#374151', marginBottom: 4 },
  group: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  stopsBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 12 },
  stopsLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  stopItem: { fontSize: 13, color: '#374151', paddingVertical: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: {},
  metaLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  metaValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  notesBox: { backgroundColor: '#fffbeb', borderRadius: 8, padding: 10 },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#92400e', marginBottom: 2 },
  notes: { fontSize: 13, color: '#78350f' },
  actions: { gap: 10, marginBottom: 20 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  bookedPill: { backgroundColor: '#dcfce7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bookedText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  payBtn: { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  paidPill: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  paidText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  reqCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  reqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reqName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  reqMeta: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  reqMsg: { fontSize: 13, color: '#374151', fontStyle: 'italic', marginBottom: 8 },
  reqActions: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, backgroundColor: '#dcfce7', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  confirmBtnText: { color: '#16a34a', fontWeight: '600' },
  declineBtn: { flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  declineBtnText: { color: '#dc2626', fontWeight: '600' },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 14,
  },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '500' },
  submitBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600' },
})

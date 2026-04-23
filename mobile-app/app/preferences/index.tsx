import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useRouter } from 'expo-router'
import { preferencesApi } from '../../src/api/preferences'
import { extractError } from '../../src/api/client'
import type { RidePreference } from '../../src/types'

function PreferenceCard({
  pref,
  onDelete,
  onPosted,
}: {
  pref: RidePreference
  onDelete: (id: string) => void
  onPosted: (rideId: string) => void
}) {
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handlePost = async () => {
    if (!departureDate || !departureTime) {
      setError('Enter date and time')
      return
    }
    setError('')
    setPosting(true)
    try {
      const dt = new Date(`${departureDate}T${departureTime}`).toISOString()
      const ride = await preferencesApi.postFromPreference(pref.id, dt)
      onPosted(ride.id)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = () => {
    Alert.alert('Delete Preference', `Delete "${pref.tag}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await preferencesApi.delete(pref.id); onDelete(pref.id) }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.tagBadge}>
          <Text style={s.tagText}>{pref.tag}</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.groupName}>{pref.groupName}</Text>
          <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
            <Text style={s.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.route}>
        <View style={s.stopRow}>
          <View style={[s.dot, { backgroundColor: '#16a34a' }]} />
          <Text style={s.stopName}>{pref.originLocation.name}</Text>
        </View>
        {pref.intermediateStops.map(stop => (
          <View key={stop.id} style={s.stopRow}>
            <Text style={s.stopDash}>│</Text>
            <Text style={[s.stopName, { color: '#6b7280' }]}>{stop.name}</Text>
          </View>
        ))}
        <View style={s.stopRow}>
          <View style={[s.dot, { backgroundColor: '#dc2626' }]} />
          <Text style={s.stopName}>{pref.destinationLocation.name}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <Text style={s.meta}>🪑 {pref.totalSeats} seat{pref.totalSeats !== 1 ? 's' : ''}</Text>
        {pref.price != null && <Text style={s.meta}>₹{pref.price}/seat</Text>}
        {pref.notes && <Text style={s.meta} numberOfLines={1}>{pref.notes}</Text>}
      </View>

      <View style={s.postSection}>
        <Text style={s.postLabel}>Post this ride</Text>
        <View style={s.postRow}>
          <TextInput
            style={s.postInput}
            placeholder="Date (YYYY-MM-DD)"
            value={departureDate}
            onChangeText={setDepartureDate}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={s.postInput}
            placeholder="Time (HH:MM)"
            value={departureTime}
            onChangeText={setDepartureTime}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={posting}>
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
        {!!error && <Text style={s.error}>{error}</Text>}
      </View>
    </View>
  )
}

export default function PreferencesScreen() {
  const router = useRouter()
  const [preferences, setPreferences] = useState<RidePreference[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    preferencesApi.getMyPreferences().then(setPreferences).finally(() => setLoading(false))
  }, [])

  const handleDelete = (id: string) => setPreferences(prev => prev.filter(p => p.id !== id))
  const handlePosted = (rideId: string) => router.push(`/rides/${rideId}`)

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Text style={s.title}>My Preferences</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push('/rides/new')}>
          <Text style={s.newBtnText}>+ New Ride</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : preferences.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏷️</Text>
          <Text style={s.emptyTitle}>No preferences yet</Text>
          <Text style={s.emptySub}>Save frequent routes as preferences to post rides faster</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/rides/new')}>
            <Text style={s.emptyBtnText}>Create a preference</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" enableOnAndroid>
          {preferences.map(pref => (
            <PreferenceCard key={pref.id} pref={pref} onDelete={handleDelete} onPosted={handlePosted} />
          ))}
        </KeyboardAwareScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  newBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 14, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tagBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupName: { fontSize: 12, color: '#9ca3af' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  route: { marginBottom: 10 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stopDash: { fontSize: 12, color: '#d1d5db', width: 10, textAlign: 'center' },
  stopName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  meta: { fontSize: 12, color: '#6b7280' },
  postSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  postLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  postRow: { flexDirection: 'row', gap: 6 },
  postInput: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#111827',
  },
  postBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  postBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})

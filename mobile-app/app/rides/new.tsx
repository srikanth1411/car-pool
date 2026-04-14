import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ridesApi } from '../../src/api/rides'
import { groupsApi } from '../../src/api/groups'
import { preferencesApi } from '../../src/api/preferences'
import { useAuthStore } from '../../src/store/authStore'
import { extractError } from '../../src/api/client'
import type { Group, GroupLocation } from '../../src/types'

function Picker({
  label,
  options,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  options: GroupLocation[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.id === value)

  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <TouchableOpacity
        style={[field.picker, disabled && field.pickerDisabled]}
        onPress={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
      >
        <Text style={[field.pickerText, !selected && field.pickerPlaceholder]}>
          {selected ? selected.name : (placeholder ?? 'Select…')}
        </Text>
        <Text style={field.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={field.dropdown}>
          <TouchableOpacity style={field.dropdownItem} onPress={() => { onChange(''); setOpen(false) }}>
            <Text style={field.dropdownText}>— None —</Text>
          </TouchableOpacity>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[field.dropdownItem, value === opt.id && field.dropdownItemActive]}
              onPress={() => { onChange(opt.id); setOpen(false) }}
            >
              <Text style={[field.dropdownText, value === opt.id && field.dropdownTextActive]}>{opt.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

export default function CreateRideScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [locations, setLocations] = useState<GroupLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)

  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [selectedStops, setSelectedStops] = useState<string[]>([])
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [totalSeats, setTotalSeats] = useState('3')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saveAsPreference, setSaveAsPreference] = useState(false)
  const [preferenceTag, setPreferenceTag] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    groupsApi.getMyGroups()
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedGroupId) { setLocations([]); setOriginId(''); setDestinationId(''); return }
    const group = groups.find(g => g.id === selectedGroupId)
    if (group?.locations?.length) {
      setLocations(group.locations)
    } else {
      groupsApi.getLocations(selectedGroupId).then(setLocations)
    }
  }, [selectedGroupId])

  const intermediateOptions = locations.filter(l => l.id !== originId && l.id !== destinationId)

  const toggleStop = (id: string) => {
    setSelectedStops(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleSubmit = async () => {
    setError('')
    if (!selectedGroupId) { setError('Select a group'); return }
    if (!originId) { setError('Select a start point'); return }
    if (!destinationId) { setError('Select an end point'); return }
    if (originId === destinationId) { setError('Start and end point cannot be the same'); return }
    if (!departureDate || !departureTime) { setError('Set departure date and time'); return }
    if (saveAsPreference && !preferenceTag.trim()) { setError('Enter a preference tag name'); return }

    const departureISO = new Date(`${departureDate}T${departureTime}`).toISOString()
    const cleanedStops = selectedStops.filter(id => id !== originId && id !== destinationId)

    setSubmitting(true)
    try {
      if (saveAsPreference) {
        await preferencesApi.save({
          tag: preferenceTag.trim(),
          groupId: selectedGroupId,
          originLocationId: originId,
          destinationLocationId: destinationId,
          intermediateLocationIds: cleanedStops,
          totalSeats: parseInt(totalSeats) || 3,
          price: price ? parseFloat(price) : undefined,
          notes: notes || undefined,
        })
      }
      const ride = await ridesApi.create({
        groupId: selectedGroupId,
        originLocationId: originId,
        destinationLocationId: destinationId,
        intermediateLocationIds: cleanedStops,
        departureTime: departureISO,
        totalSeats: parseInt(totalSeats) || 3,
        price: price ? parseFloat(price) : undefined,
        notes: notes || undefined,
      })
      router.replace(`/rides/${ride.id}`)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />

  const selectedGroup = groups.find(g => g.id === selectedGroupId)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Group picker */}
      <View style={field.wrap}>
        <Text style={field.label}>Group</Text>
        <TouchableOpacity style={field.picker} onPress={() => setGroupPickerOpen(v => !v)}>
          <Text style={[field.pickerText, !selectedGroup && field.pickerPlaceholder]}>
            {selectedGroup ? selectedGroup.name : 'Select a group…'}
          </Text>
          <Text style={field.chevron}>{groupPickerOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {groupPickerOpen && (
          <View style={field.dropdown}>
            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[field.dropdownItem, selectedGroupId === g.id && field.dropdownItemActive]}
                onPress={() => { setSelectedGroupId(g.id); setGroupPickerOpen(false) }}
              >
                <Text style={[field.dropdownText, selectedGroupId === g.id && field.dropdownTextActive]}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {selectedGroupId && locations.length === 0 && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>This group has no stops yet. An admin must add stops before rides can be posted.</Text>
        </View>
      )}

      <Picker
        label="Start point"
        options={locations.filter(l => l.id !== destinationId)}
        value={originId}
        onChange={setOriginId}
        disabled={locations.length === 0}
        placeholder={locations.length === 0 ? 'Select a group first' : 'Select start point…'}
      />

      <Picker
        label="End point"
        options={locations.filter(l => l.id !== originId)}
        value={destinationId}
        onChange={setDestinationId}
        disabled={locations.length === 0}
        placeholder={locations.length === 0 ? 'Select a group first' : 'Select end point…'}
      />

      {originId && destinationId && originId !== destinationId && intermediateOptions.length > 0 && (
        <View style={field.wrap}>
          <Text style={field.label}>Stops in between (optional)</Text>
          <View style={styles.stopsRow}>
            {intermediateOptions.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.stopPill, selectedStops.includes(opt.id) && styles.stopPillActive]}
                onPress={() => toggleStop(opt.id)}
              >
                <Text style={[styles.stopPillText, selectedStops.includes(opt.id) && styles.stopPillTextActive]}>
                  {opt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={field.wrap}>
        <Text style={field.label}>Departure date (YYYY-MM-DD)</Text>
        <TextInput
          style={field.input}
          placeholder="e.g. 2026-04-15"
          value={departureDate}
          onChangeText={setDepartureDate}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={field.wrap}>
        <Text style={field.label}>Departure time (HH:MM)</Text>
        <TextInput
          style={field.input}
          placeholder="e.g. 08:30"
          value={departureTime}
          onChangeText={setDepartureTime}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={field.wrap}>
        <Text style={field.label}>Available seats</Text>
        <TextInput
          style={field.input}
          keyboardType="number-pad"
          value={totalSeats}
          onChangeText={setTotalSeats}
        />
      </View>

      <View style={field.wrap}>
        <Text style={field.label}>Price per seat (optional)</Text>
        <TextInput
          style={field.input}
          keyboardType="decimal-pad"
          placeholder="e.g. 50.00"
          value={price}
          onChangeText={setPrice}
        />
      </View>

      <View style={field.wrap}>
        <Text style={field.label}>Notes (optional)</Text>
        <TextInput
          style={[field.input, { height: 72, textAlignVertical: 'top' }]}
          multiline
          placeholder="e.g. No pets, quiet ride"
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      {/* Save as preference */}
      <View style={styles.prefRow}>
        <View>
          <Text style={styles.prefLabel}>Also save as preference</Text>
          <Text style={styles.prefSub}>Re-post this route anytime with a date</Text>
        </View>
        <Switch
          value={saveAsPreference}
          onValueChange={setSaveAsPreference}
          trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
          thumbColor={saveAsPreference ? '#2563eb' : '#9ca3af'}
        />
      </View>
      {saveAsPreference && (
        <View style={field.wrap}>
          <Text style={field.label}>Preference tag</Text>
          <TextInput
            style={field.input}
            placeholder='e.g. "Morning Ride"'
            value={preferenceTag}
            onChangeText={setPreferenceTag}
          />
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Ride</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  warnBox: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 14 },
  warnText: { fontSize: 13, color: '#92400e' },
  stopsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stopPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  stopPillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stopPillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  stopPillTextActive: { color: '#fff' },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
  },
  prefLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  prefSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#dc2626', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '500', fontSize: 15 },
  submitBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

const field = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, backgroundColor: '#fff',
  },
  pickerDisabled: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  pickerText: { fontSize: 15, color: '#111827', flex: 1 },
  pickerPlaceholder: { color: '#9ca3af' },
  chevron: { fontSize: 11, color: '#9ca3af' },
  dropdown: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff',
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownText: { fontSize: 15, color: '#374151' },
  dropdownTextActive: { color: '#2563eb', fontWeight: '600' },
})

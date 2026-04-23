import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Switch, Image,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useRouter } from 'expo-router'
import { groupsApi } from '../../src/api/groups'
import { useAuthStore } from '../../src/store/authStore'
import { extractError } from '../../src/api/client'
import { pickAndUploadImage } from '../../src/utils/pickImage'
import type { Group, GroupField, GroupFieldType } from '../../src/types'

const FIELD_TYPES: { value: GroupFieldType; label: string; icon: string }[] = [
  { value: 'TEXT',     label: 'Text',     icon: '✏️' },
  { value: 'EMAIL',    label: 'Email',    icon: '📧' },
  { value: 'PHOTO',    label: 'Photo',    icon: '📷' },
  { value: 'ID_CARD',  label: 'ID Card',  icon: '🪪' },
  { value: 'FILE',     label: 'File',     icon: '📎' },
]

type DraftField = { label: string; fieldType: GroupFieldType; required: boolean }

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [locations, setLocations] = useState<string[]>([])
  const [locationInput, setLocationInput] = useState('')
  const [fields, setFields] = useState<DraftField[]>([])
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<GroupFieldType>('TEXT')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addLocation = () => {
    const trimmed = locationInput.trim()
    if (!trimmed) return
    setLocations(prev => [...prev, trimmed])
    setLocationInput('')
  }

  const removeLocation = (i: number) => setLocations(prev => prev.filter((_, idx) => idx !== i))

  const addField = () => {
    if (!fieldLabel.trim()) return
    setFields(prev => [...prev, { label: fieldLabel.trim(), fieldType, required: fieldRequired }])
    setFieldLabel('')
    setFieldType('TEXT')
    setFieldRequired(false)
  }

  const removeField = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i))

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      await groupsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
        locations: locations.length > 0 ? locations.map(l => ({ name: l })) : undefined,
        fields: fields.length > 0 ? fields.map((f, i) => ({ ...f, displayOrder: i })) : undefined,
      })
      onCreated()
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <View style={modal.overlay}>
          <KeyboardAwareScrollView style={modal.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" enableOnAndroid>
            <Text style={modal.title}>New Group</Text>

            <Text style={modal.label}>Group Name</Text>
            <TextInput style={modal.input} placeholder="e.g. Whitefield Riders" value={name} onChangeText={setName} />

            <Text style={modal.label}>Description (optional)</Text>
            <TextInput style={[modal.input, { height: 72, textAlignVertical: 'top' }]} placeholder="About this group" multiline value={description} onChangeText={setDescription} />

            <View style={modal.switchRow}>
              <Text style={modal.switchLabel}>Private group</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#e5e7eb', true: '#93c5fd' }} thumbColor={isPrivate ? '#2563eb' : '#9ca3af'} />
            </View>

            {/* Locations */}
            <Text style={modal.label}>Locations / Stops (optional)</Text>
            <View style={modal.locationRow}>
              <TextInput style={[modal.input, { flex: 1, marginBottom: 0 }]} placeholder="e.g. Silk Board" value={locationInput} onChangeText={setLocationInput} onSubmitEditing={addLocation} returnKeyType="done" />
              <TouchableOpacity style={modal.addBtn} onPress={addLocation}><Text style={modal.addBtnText}>Add</Text></TouchableOpacity>
            </View>
            {locations.length > 0 && (
              <View style={modal.chipRow}>
                {locations.map((loc, i) => (
                  <View key={i} style={modal.chip}>
                    <Text style={modal.chipText}>{loc}</Text>
                    <TouchableOpacity onPress={() => removeLocation(i)}><Text style={modal.chipRemove}>×</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Application Fields */}
            <Text style={[modal.sectionHeader]}>Application Fields</Text>
            <Text style={modal.sectionSub}>Fields users must fill when joining</Text>

            <Text style={modal.label}>Field label</Text>
            <TextInput style={modal.input} placeholder="e.g. Work Email, ID Card, Photo" value={fieldLabel} onChangeText={setFieldLabel} />

            <Text style={modal.label}>Field type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FIELD_TYPES.map(ft => (
                  <TouchableOpacity key={ft.value} style={[modal.typeChip, fieldType === ft.value && modal.typeChipActive]} onPress={() => setFieldType(ft.value)}>
                    <Text style={modal.typeChipIcon}>{ft.icon}</Text>
                    <Text style={[modal.typeChipText, fieldType === ft.value && modal.typeChipTextActive]}>{ft.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={[modal.switchRow, { marginBottom: 8 }]}>
              <Text style={modal.switchLabel}>Required</Text>
              <Switch value={fieldRequired} onValueChange={setFieldRequired} trackColor={{ false: '#e5e7eb', true: '#93c5fd' }} thumbColor={fieldRequired ? '#2563eb' : '#9ca3af'} />
            </View>

            <TouchableOpacity style={modal.addFieldBtn} onPress={addField}>
              <Text style={modal.addFieldBtnText}>+ Add Field</Text>
            </TouchableOpacity>

            {fields.length > 0 && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {fields.map((f, i) => (
                  <View key={i} style={modal.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={modal.fieldRowLabel}>{f.label}</Text>
                      <Text style={modal.fieldRowMeta}>{FIELD_TYPES.find(t => t.value === f.fieldType)?.icon} {f.fieldType}{f.required ? ' · required' : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeField(i)}><Text style={modal.chipRemove}>×</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {!!error && <Text style={[modal.error, { marginTop: 10 }]}>{error}</Text>}
            <View style={[modal.actions, { marginTop: 16 }]}>
              <TouchableOpacity style={modal.cancelBtn} onPress={onClose}><Text style={modal.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={modal.submitBtn} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={modal.submitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Join modal (multi-step: enter code → preview group + fill fields → submit) ─────

type FieldAnswer = { fieldId: string; value: string }

function JoinGroupModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [step, setStep] = useState<'code' | 'fields'>('code')
  const [code, setCode] = useState('')
  const [group, setGroup] = useState<Group | null>(null)
  const [answers, setAnswers] = useState<FieldAnswer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async () => {
    if (!code.trim()) { setError('Invite code is required'); return }
    setLoading(true)
    setError('')
    try {
      const g = await groupsApi.getGroupByInviteCode(code.trim())
      setGroup(g)
      setAnswers((g.fields ?? []).map(f => ({ fieldId: f.id, value: '' })))
      setStep('fields')
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }

  const setAnswer = (fieldId: string, value: string) => {
    setAnswers(prev => prev.map(a => a.fieldId === fieldId ? { ...a, value } : a))
  }

  const handleJoin = async () => {
    if (!group) return
    // Validate required fields
    for (const f of group.fields ?? []) {
      if (f.required) {
        const ans = answers.find(a => a.fieldId === f.id)
        if (!ans?.value?.trim()) { setError(`"${f.label}" is required`); return }
      }
    }
    setLoading(true)
    setError('')
    try {
      await groupsApi.join(code.trim(), answers.filter(a => a.value.trim()))
      onJoined()
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <View style={modal.overlay}>
          <KeyboardAwareScrollView style={modal.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }} enableOnAndroid>
              {step === 'code' ? (
                <>
                  <Text style={modal.title}>Join Group</Text>
                  <Text style={modal.label}>Invite Code</Text>
                  <TextInput style={modal.input} placeholder="Enter invite code" value={code} onChangeText={setCode} autoCapitalize="none" />
                  {!!error && <Text style={modal.error}>{error}</Text>}
                  <View style={modal.actions}>
                    <TouchableOpacity style={modal.cancelBtn} onPress={onClose}><Text style={modal.cancelText}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={modal.submitBtn} onPress={handleLookup} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={modal.submitText}>Next →</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => { setStep('code'); setError('') }} style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#2563eb', fontSize: 14 }}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={modal.title}>{group?.name}</Text>
                  {group?.description ? <Text style={modal.groupDesc}>{group.description}</Text> : null}
                  <Text style={modal.groupMeta}>
                    👥 {group?.memberCount} member{group?.memberCount !== 1 ? 's' : ''} · {group?.isPrivate ? '🔒 Private' : '🔓 Public'}
                  </Text>

                  {(group?.fields ?? []).length > 0 && (
                    <>
                      <Text style={[modal.sectionHeader, { marginTop: 12 }]}>
                        Application Details ({group!.fields.length} field{group!.fields.length !== 1 ? 's' : ''})
                      </Text>
                      {group!.fields.map(f => (
                        <JoinField
                          key={f.id}
                          field={f}
                          value={answers.find(a => a.fieldId === f.id)?.value ?? ''}
                          onChange={v => setAnswer(f.id, v)}
                        />
                      ))}
                    </>
                  )}

                  {!!error && <Text style={modal.error}>{error}</Text>}
                  <View style={[modal.actions, { marginTop: 16 }]}>
                    <TouchableOpacity style={modal.cancelBtn} onPress={onClose}><Text style={modal.cancelText}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={modal.submitBtn} onPress={handleJoin} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={modal.submitText}>Join</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  )
}

function JoinField({ field, value, onChange }: { field: GroupField; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)

  const handlePickImage = async () => {
    const url = await pickAndUploadImage(setUploading)
    if (url) onChange(url)
  }

  const isMedia = field.fieldType === 'PHOTO' || field.fieldType === 'ID_CARD' || field.fieldType === 'FILE'

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={modal.label}>
        {FIELD_TYPES.find(t => t.value === field.fieldType)?.icon} {field.label}
        {field.required ? <Text style={{ color: '#dc2626' }}> *</Text> : ''}
      </Text>
      {isMedia ? (
        <View>
          {!!value && (field.fieldType === 'PHOTO' || field.fieldType === 'ID_CARD') ? (
            <>
              <Image source={{ uri: value }} style={modal.previewImage} resizeMode="contain" />
              <TouchableOpacity style={[modal.uploadBtn, { marginTop: 8 }]} onPress={handlePickImage} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#2563eb" size="small" /> : <Text style={modal.uploadBtnText}>🔄 Change photo</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={modal.uploadBtn} onPress={handlePickImage} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#2563eb" size="small" /> : <Text style={modal.uploadBtnText}>📁 Choose file / image</Text>}
              </TouchableOpacity>
              {!!value && <Text style={modal.uploadedUrl} numberOfLines={1}>✓ {value.split('/').pop()}</Text>}
            </>
          )}
        </View>
      ) : (
        <TextInput
          style={modal.input}
          placeholder={field.fieldType === 'EMAIL' ? 'you@company.com' : `Enter ${field.label.toLowerCase()}`}
          keyboardType={field.fieldType === 'EMAIL' ? 'email-address' : 'default'}
          autoCapitalize="none"
          value={value}
          onChangeText={onChange}
        />
      )}
    </View>
  )
}

// ─── Main Groups Screen ──────────────────────────────────────────────────────

export default function GroupsScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const canCreateGroup = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const load = () => {
    setLoading(true)
    groupsApi.getMyGroups().then(setGroups).finally(() => setLoading(false))
  }

  useFocusEffect(useCallback(() => { load() }, []))

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>My Groups</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowJoin(true)}>
            <Text style={styles.outlineBtnText}>Join</Text>
          </TouchableOpacity>
          {canCreateGroup && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.primaryBtnText}>+ New</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySub}>Create or join a carpool group to get started</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groups.map(group => (
            <TouchableOpacity key={group.id} style={styles.card} onPress={() => router.push(`/groups/${group.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName}>{group.name}</Text>
                <Text style={styles.lockIcon}>{group.isPrivate ? '🔒' : '🔓'}</Text>
              </View>
              {group.description ? <Text style={styles.cardDesc} numberOfLines={2}>{group.description}</Text> : null}
              <View style={styles.cardRow}>
                <Text style={styles.cardMeta}>👥  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</Text>
                {(group.fields ?? []).length > 0 && <Text style={styles.cardMeta}>📋 {group.fields.length} field{group.fields.length !== 1 ? 's' : ''}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} onJoined={() => { setShowJoin(false); load() }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  topBarActions: { flexDirection: 'row', gap: 8 },
  outlineBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  outlineBtnText: { color: '#374151', fontWeight: '500', fontSize: 14 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  lockIcon: { fontSize: 16 },
  cardDesc: { fontSize: 13, color: '#6b7280', marginBottom: 8, lineHeight: 18 },
  cardMeta: { fontSize: 12, color: '#9ca3af' },
  emptyCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '92%' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  groupDesc: { fontSize: 13, color: '#6b7280', marginBottom: 4, lineHeight: 18 },
  groupMeta: { fontSize: 12, color: '#9ca3af', marginBottom: 14 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 2, marginTop: 4 },
  sectionSub: { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 14,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  switchLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  chipText: { fontSize: 13, color: '#1d4ed8', fontWeight: '500' },
  chipRemove: { fontSize: 18, color: '#6b7280', lineHeight: 18 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  typeChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  typeChipIcon: { fontSize: 16 },
  typeChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  typeChipTextActive: { color: '#2563eb' },
  addFieldBtn: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addFieldBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  fieldRowLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  fieldRowMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  uploadBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 6 },
  uploadBtnText: { color: '#374151', fontSize: 14 },
  uploadedUrl: { fontSize: 12, color: '#16a34a', marginBottom: 8 },
  previewImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#f3f4f6' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '500' },
  submitBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600' },
})

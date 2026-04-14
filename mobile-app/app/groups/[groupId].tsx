import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Clipboard,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { groupsApi } from '../../src/api/groups'
import { ridesApi } from '../../src/api/rides'
import { useAuthStore } from '../../src/store/authStore'
import type { Group, GroupLocation, Membership, Ride } from '../../src/types'

type Tab = 'rides' | 'members' | 'locations'

function formatTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Membership[]>([])
  const [pendingRequests, setPendingRequests] = useState<Membership[]>([])
  const [rides, setRides] = useState<Ride[]>([])
  const [locations, setLocations] = useState<GroupLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('rides')
  const [locName, setLocName] = useState('')
  const [addingLoc, setAddingLoc] = useState(false)

  const isAdmin = members.find(m => m.user.id === user?.id)?.role === 'ADMIN'
  const isOwner = group?.owner?.id === user?.id

  const load = async () => {
    if (!groupId) return
    try {
      const [g, m, r] = await Promise.all([
        groupsApi.getGroup(groupId),
        groupsApi.getMembers(groupId),
        ridesApi.getGroupRides(groupId),
      ])
      setGroup(g)
      setMembers(m)
      setRides(r)
      setLocations(g.locations ?? [])
      const amAdmin = m.find(mem => mem.user.id === user?.id)?.role === 'ADMIN'
      if (amAdmin) {
        groupsApi.getPendingRequests(groupId).then(setPendingRequests)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [groupId])

  const copyInviteCode = () => {
    if (group) {
      Clipboard.setString(group.inviteCode)
      Alert.alert('Copied', `Invite code "${group.inviteCode}" copied to clipboard`)
    }
  }

  const handleApprove = async (userId: string) => {
    if (!groupId) return
    await groupsApi.approveMember(groupId, userId)
    load()
  }

  const handleReject = async (userId: string) => {
    if (!groupId) return
    await groupsApi.rejectMember(groupId, userId)
    load()
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!groupId) return
    Alert.alert('Remove Member', `Remove ${name} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await groupsApi.removeMember(groupId, userId); load() } },
    ])
  }

  const handleDeleteGroup = () => {
    if (!groupId || !group) return
    Alert.alert('Delete Group', `Delete "${group.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await groupsApi.deleteGroup(groupId)
        router.back()
      }},
    ])
  }

  const handleAddLocation = async () => {
    if (!groupId || !locName.trim()) return
    setAddingLoc(true)
    try {
      const loc = await groupsApi.addLocation(groupId, { name: locName.trim() })
      setLocations(prev => [...prev, loc])
      setLocName('')
    } finally {
      setAddingLoc(false)
    }
  }

  const handleRemoveLocation = (locationId: string, name: string) => {
    if (!groupId) return
    Alert.alert('Remove Location', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await groupsApi.removeLocation(groupId, locationId)
        setLocations(prev => prev.filter(l => l.id !== locationId))
      }},
    ])
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
  if (!group) return <View style={styles.center}><Text style={styles.notFound}>Group not found</Text></View>

  const pendingCount = isAdmin ? pendingRequests.length : 0
  const tabs: { key: Tab; label: string }[] = [
    { key: 'rides', label: `Rides (${rides.length})` },
    { key: 'members', label: `Members (${members.length})${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}` },
    { key: 'locations', label: `Locations (${locations.length})` },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.privacy}>{group.isPrivate ? '🔒 Private' : '🔓 Public'}</Text>
        </View>
        {group.description ? <Text style={styles.desc}>{group.description}</Text> : null}
        <TouchableOpacity style={styles.inviteRow} onPress={copyInviteCode}>
          <Text style={styles.inviteLabel}>Invite Code:</Text>
          <Text style={styles.inviteCode}>{group.inviteCode}</Text>
          <Text style={styles.copyIcon}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
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

      {/* Rides tab */}
      {activeTab === 'rides' && (
        <View style={styles.section}>
          {rides.length === 0 ? (
            <Text style={styles.empty}>No rides yet</Text>
          ) : (
            rides.map(ride => (
              <TouchableOpacity key={ride.id} style={styles.card} onPress={() => router.push(`/rides/${ride.id}`)}>
                <Text style={styles.route}>{ride.origin} → {ride.destination}</Text>
                <Text style={styles.time}>{formatTime(ride.departureTime)}</Text>
                <Text style={styles.driverText}>Driver: {ride.driver.name}</Text>
                <Text style={styles.seats}>{ride.availableSeats}/{ride.totalSeats} seats · {ride.status}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Members tab */}
      {activeTab === 'members' && (
        <View style={styles.section}>
          {isAdmin && pendingRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pending Requests ({pendingRequests.length})</Text>
              {pendingRequests.map(req => (
                <TouchableOpacity key={req.id} style={styles.requestRow} onPress={() => router.push(`/groups/application/${req.id}?groupId=${groupId}&userId=${req.user.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{req.user.name}</Text>
                    <Text style={styles.memberEmail}>{req.user.email}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Tap to view application →</Text>
                  </View>
                  <View style={styles.reqActions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(req.user.id)}>
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req.user.id)}>
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Approved Members ({members.length})</Text>
            </>
          )}
          {members.map(m => (
            <View key={m.id} style={styles.memberRow}>
              <View>
                <Text style={styles.memberName}>{m.user.name}</Text>
                <Text style={styles.memberEmail}>{m.user.email}</Text>
              </View>
              <View style={styles.memberRight}>
                <View style={[styles.roleBadge, m.role === 'ADMIN' ? styles.roleBadgeAdmin : styles.roleBadgeMember]}>
                  <Text style={[styles.roleText, m.role === 'ADMIN' ? styles.roleTextAdmin : styles.roleTextMember]}>
                    {m.role}
                  </Text>
                </View>
                {isAdmin && m.user.id !== user?.id && (
                  <TouchableOpacity onPress={() => handleRemove(m.user.id, m.user.name)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Locations tab */}
      {activeTab === 'locations' && (
        <View style={styles.section}>
          {locations.map(loc => (
            <View key={loc.id} style={styles.locRow}>
              <Text style={styles.locName}>📍 {loc.name}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => handleRemoveLocation(loc.id, loc.name)}>
                  <Text style={styles.removeBtn}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isAdmin && (
            <View style={styles.addLocRow}>
              <TextInput
                style={styles.locInput}
                placeholder="Location name"
                value={locName}
                onChangeText={setLocName}
              />
              <TouchableOpacity style={styles.addLocBtn} onPress={handleAddLocation} disabled={addingLoc}>
                {addingLoc ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addLocBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Delete group */}
      {isOwner && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGroup}>
          <Text style={styles.deleteBtnText}>🗑  Delete Group</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#6b7280', fontSize: 16 },
  header: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  groupName: { fontSize: 20, fontWeight: '700', color: '#111827', flex: 1 },
  privacy: { fontSize: 13, color: '#6b7280' },
  desc: { fontSize: 14, color: '#6b7280', marginBottom: 10, lineHeight: 20 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10, gap: 8 },
  inviteLabel: { fontSize: 13, color: '#6b7280' },
  inviteCode: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  copyIcon: { fontSize: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  reqActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  rejectBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rejectBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  route: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  time: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  driverText: { fontSize: 12, color: '#6b7280' },
  seats: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  memberEmail: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  memberRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeAdmin: { backgroundColor: '#dbeafe' },
  roleBadgeMember: { backgroundColor: '#f3f4f6' },
  roleText: { fontSize: 11, fontWeight: '600' },
  roleTextAdmin: { color: '#2563eb' },
  roleTextMember: { color: '#6b7280' },
  removeBtn: { fontSize: 16, color: '#9ca3af', paddingHorizontal: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  locName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  addLocRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  locInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addLocBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addLocBtnText: { color: '#fff', fontWeight: '600' },
  deleteBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  deleteBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  empty: { color: '#9ca3af', textAlign: 'center', padding: 24 },
})

import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { notificationsApi } from '../../src/api/notifications'
import { groupsApi } from '../../src/api/groups'
import type { Notification } from '../../src/types'

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const typeIcons: Record<string, string> = {
  JOIN_REQUEST_RECEIVED:    '🙋',
  JOIN_APPROVED:            '✅',
  JOIN_REJECTED:            '❌',
  RIDE_POSTED:              '🚗',
  RIDE_REQUEST_RECEIVED:    '🙋',
  RIDE_REQUEST_CONFIRMED:   '✅',
  RIDE_REQUEST_DECLINED:    '❌',
  RIDE_CANCELLED:           '🚫',
  RIDE_STARTED:             '▶️',
  CHAT_MESSAGE:             '💬',
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    notificationsApi.getAll().then(setNotifications).finally(() => setLoading(false))
  }, [])

  useFocusEffect(load)

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleApprove = async (n: Notification) => {
    const { groupId, userId } = n.metadata ?? {}
    if (!groupId || !userId) return
    try {
      await groupsApi.approveMember(groupId, userId)
      setNotifications(prev => prev.filter(x => x.id !== n.id))
      Alert.alert('Approved', 'Member has been approved.')
    } catch {
      Alert.alert('Error', 'Could not approve member.')
    }
  }

  const handleReject = async (n: Notification) => {
    const { groupId, userId } = n.metadata ?? {}
    if (!groupId || !userId) return
    try {
      await groupsApi.rejectMember(groupId, userId)
      setNotifications(prev => prev.filter(x => x.id !== n.id))
      Alert.alert('Rejected', 'Member request has been rejected.')
    } catch {
      Alert.alert('Error', 'Could not reject member.')
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptySub}>You're all caught up!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.item, !n.read && styles.itemUnread]}
              onPress={() => !n.read && markRead(n.id)}
              activeOpacity={n.type === 'JOIN_REQUEST_RECEIVED' ? 1 : 0.7}
            >
              <View style={styles.itemIcon}>
                <Text style={styles.itemIconText}>{typeIcons[n.type] ?? '🔔'}</Text>
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{n.title}</Text>
                  {!n.read && <View style={styles.dot} />}
                </View>
                <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.itemTime}>{timeAgo(n.createdAt)}</Text>
                {n.type === 'JOIN_REQUEST_RECEIVED' && !n.read && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(n)}>
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(n)}>
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  markAll: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  list: { padding: 12, gap: 8 },
  item: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  itemUnread: { borderLeftWidth: 3, borderLeftColor: '#2563eb', backgroundColor: '#eff6ff' },
  itemIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  itemIconText: { fontSize: 18 },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  itemBody: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 4 },
  itemTime: { fontSize: 11, color: '#9ca3af' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6b7280' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  approveBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  rejectBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  rejectBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
})

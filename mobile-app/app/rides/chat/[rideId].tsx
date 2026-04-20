import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Keyboard, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { chatApi } from '../../../src/api/chat'
import { useAuthStore } from '../../../src/store/authStore'
import type { RideMessage, User } from '../../../src/types'

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Avatar({ name }: { name: string }) {
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{name[0].toUpperCase()}</Text>
    </View>
  )
}

export default function RideChatScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [messages, setMessages] = useState<RideMessage[]>([])
  const [participants, setParticipants] = useState<User[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionStart, setMentionStart] = useState(-1)
  const [pendingMentions, setPendingMentions] = useState<User[]>([])
  // Extra bottom padding to push content above the keyboard
  const [keyboardPad, setKeyboardPad] = useState(0)

  const flatListRef = useRef<FlatList>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // SafeAreaView handles the home-indicator inset (insets.bottom ≈ 34px).
  // endCoordinates.height = full keyboard height measured from the screen bottom,
  // which includes the home-indicator area. Subtract insets.bottom to get the
  // extra space we need to add on top of what SafeAreaView already reserves.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, (e) => {
      const pad = e.endCoordinates.height - insets.bottom
      setKeyboardPad(pad > 0 ? pad : 0)
    })
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardPad(0))

    return () => { show.remove(); hide.remove() }
  }, [insets.bottom])

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await chatApi.getMessages(rideId!)
      setMessages(msgs)
    } catch { /* ride may not be departed yet */ }
    finally { setLoading(false) }
  }, [rideId])

  useEffect(() => {
    fetchMessages()
    chatApi.getParticipants(rideId!).then(setParticipants).catch(() => {})
    pollRef.current = setInterval(fetchMessages, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [rideId, fetchMessages])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const handleInput = (val: string) => {
    setInput(val)
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const after = val.slice(atIdx + 1)
      if (/^\w*$/.test(after)) {
        setMentionStart(atIdx)
        setMentionQuery(after.toLowerCase())
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  const selectMention = (p: User) => {
    const firstName = p.name.split(' ')[0]
    const before = input.slice(0, mentionStart)
    const after = input.slice(mentionStart + 1 + mentionQuery.length)
    setInput(`${before}@${firstName}${after} `)
    setPendingMentions(prev => prev.find(u => u.id === p.id) ? prev : [...prev, p])
    setShowMentions(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const msg = await chatApi.sendMessage(rideId!, text, pendingMentions.map(u => u.id))
      setMessages(prev => [...prev, msg])
      setInput('')
      setPendingMentions([])
    } catch {
      // silently fail — message stays in input
    } finally {
      setSending(false)
    }
  }

  const filteredParticipants = showMentions
    ? participants.filter(p => p.id !== user?.id && p.name.toLowerCase().includes(mentionQuery))
    : []

  const renderMessage = ({ item: msg }: { item: RideMessage }) => {
    const isMe = msg.sender.id === user?.id
    return (
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {!isMe && <Avatar name={msg.sender.name} />}
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          {!isMe && <Text style={s.senderName}>{msg.sender.name}</Text>}
          <Text style={[s.msgText, isMe && s.msgTextMe]}>
            {renderMentions(msg.content, msg.mentions, isMe)}
          </Text>
          <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{timeAgo(msg.createdAt)}</Text>
        </View>
        {isMe && <Avatar name={msg.sender.name} />}
      </View>
    )
  }

  return (
    // SafeAreaView with all edges — it adds bottom padding for the home indicator.
    // We add keyboardPad on top of that to clear the keyboard keys.
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Ride Chat</Text>
          <Text style={s.headerSub}>{participants.length > 0 ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}` : ''}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Content pushes up by keyboardPad when keyboard is open ── */}
      <View style={[s.body, { paddingBottom: keyboardPad }]}>
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>💬</Text>
                <Text style={s.emptyText}>No messages yet</Text>
                <Text style={s.emptySub}>Be the first — say hi!</Text>
              </View>
            }
          />
        )}

        {/* Mention suggestions */}
        {showMentions && filteredParticipants.length > 0 && (
          <View style={s.mentionBox}>
            {filteredParticipants.map(p => (
              <TouchableOpacity key={p.id} style={s.mentionItem} onPress={() => selectMention(p)}>
                <Avatar name={p.name} />
                <Text style={s.mentionName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={handleInput}
            placeholder="Message… use @ to mention"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.sendBtnText}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

function renderMentions(content: string, mentions: User[], isMe: boolean): React.ReactNode {
  const parts = content.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1).toLowerCase()
      const mentioned = mentions.find(u => u.name.split(' ')[0].toLowerCase() === name)
      if (mentioned) {
        return <Text key={i} style={[s.mention, isMe && s.mentionMe]}>{part}</Text>
      }
    }
    return <Text key={i}>{part}</Text>
  })
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 32, color: '#2563eb', lineHeight: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  // ── Body ────────────────────────────────────────────────────────────────
  body: { flex: 1 },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9ca3af', marginTop: 4 },

  // ── Messages ─────────────────────────────────────────────────────────────
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  avatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#dbeafe',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  bubbleThem: {
    backgroundColor: '#fff', borderTopLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  bubbleMe: { backgroundColor: '#2563eb', borderTopRightRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: '#bfdbfe' },
  mention: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '600', borderRadius: 4, overflow: 'hidden' },
  mentionMe: { backgroundColor: '#1d4ed8', color: '#bfdbfe' },

  // ── Mentions dropdown ────────────────────────────────────────────────────
  mentionBox: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', maxHeight: 160,
  },
  mentionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  mentionName: { fontSize: 14, color: '#111827', fontWeight: '500' },

  // ── Input bar ────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111827',
    backgroundColor: '#f9fafb', maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 16 },
})

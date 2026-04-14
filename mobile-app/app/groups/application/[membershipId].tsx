import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { groupsApi } from '../../../src/api/groups'
import { useAuthStore } from '../../../src/store/authStore'
import { extractError } from '../../../src/api/client'
import { pickAndUploadImage } from '../../../src/utils/pickImage'
import type { Application, MembershipComment } from '../../../src/types'

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function FieldValue({ label, type, value }: { label: string; type: string; value?: string }) {
  const isMedia = type === 'PHOTO' || type === 'ID_CARD' || type === 'FILE'
  const typeIcons: Record<string, string> = { TEXT: '✏️', EMAIL: '📧', PHOTO: '📷', ID_CARD: '🪪', FILE: '📎' }

  return (
    <View style={s.fieldCard}>
      <Text style={s.fieldLabel}>{typeIcons[type] ?? '📄'} {label}</Text>
      {!value ? (
        <Text style={s.fieldEmpty}>Not provided</Text>
      ) : isMedia ? (
        type === 'FILE' ? (
          <Text style={s.fieldLink} numberOfLines={1}>📎 {value.split('/').pop()}</Text>
        ) : (
          <Image source={{ uri: value }} style={s.fieldImage} resizeMode="cover" />
        )
      ) : (
        <Text style={s.fieldValue}>{value}</Text>
      )}
    </View>
  )
}

function CommentThread({
  comment, groupId, userId, onReplyPosted,
}: {
  comment: MembershipComment
  groupId: string
  userId: string
  onReplyPosted: () => void
}) {
  const { user } = useAuthStore()
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')

  const handlePickImage = async () => {
    const url = await pickAndUploadImage(setUploading)
    if (url) setAttachmentUrl(url)
  }

  const submitReply = async () => {
    if (!replyText.trim() && !attachmentUrl) return
    setSubmitting(true)
    try {
      await groupsApi.addComment(groupId, userId, { content: replyText.trim() || undefined, attachmentUrl: attachmentUrl || undefined, parentId: comment.id })
      setReplyText('')
      setAttachmentUrl('')
      setShowReply(false)
      onReplyPosted()
    } catch (e) {
      Alert.alert('Error', extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={s.commentCard}>
      <View style={s.commentHeader}>
        <Text style={s.commentAuthor}>{comment.author.name}</Text>
        <Text style={s.commentTime}>{timeAgo(comment.createdAt)}</Text>
      </View>
      {comment.content ? <Text style={s.commentContent}>{comment.content}</Text> : null}
      {comment.attachmentUrl ? (
        comment.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ? <Image source={{ uri: comment.attachmentUrl }} style={s.commentImage} resizeMode="cover" />
          : <Text style={s.fieldLink}>📎 {comment.attachmentUrl.split('/').pop()}</Text>
      ) : null}

      {/* Replies */}
      {comment.replies.map(reply => (
        <View key={reply.id} style={s.replyCard}>
          <View style={s.commentHeader}>
            <Text style={s.commentAuthor}>{reply.author.name}</Text>
            <Text style={s.commentTime}>{timeAgo(reply.createdAt)}</Text>
          </View>
          {reply.content ? <Text style={s.commentContent}>{reply.content}</Text> : null}
          {reply.attachmentUrl ? (
            reply.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
              ? <Image source={{ uri: reply.attachmentUrl }} style={s.commentImage} resizeMode="cover" />
              : <Text style={s.fieldLink}>📎 {reply.attachmentUrl.split('/').pop()}</Text>
          ) : null}
        </View>
      ))}

      <TouchableOpacity onPress={() => setShowReply(v => !v)} style={s.replyBtn}>
        <Text style={s.replyBtnText}>↩ Reply</Text>
      </TouchableOpacity>

      {showReply && (
        <View style={s.replyBox}>
          <TextInput
            style={s.replyInput}
            placeholder="Write a reply…"
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <View style={s.replyActions}>
            <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color="#6b7280" /> : <Text style={s.attachBtnText}>📷</Text>}
            </TouchableOpacity>
            {!!attachmentUrl && <Text style={s.uploadedSmall}>✓ image</Text>}
            <TouchableOpacity style={s.sendBtn} onPress={submitReply} disabled={submitting || (!replyText.trim() && !attachmentUrl)}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

export default function ApplicationScreen() {
  const { membershipId, groupId, userId } = useLocalSearchParams<{ membershipId: string; groupId: string; userId: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const [application, setApplication] = useState<Application | null>(null)
  const [comments, setComments] = useState<MembershipComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    if (!groupId || !userId) return
    try {
      const [app, cmts] = await Promise.all([
        groupsApi.getApplication(groupId, userId),
        groupsApi.getComments(groupId, userId),
      ])
      setApplication(app)
      setComments(cmts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [groupId, userId])

  const handleApprove = async () => {
    if (!groupId || !userId) return
    Alert.alert('Approve', `Approve ${application?.user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try { await groupsApi.approveMember(groupId, userId); router.back() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handleReject = async () => {
    if (!groupId || !userId) return
    Alert.alert('Reject', `Reject ${application?.user.name}'s request?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        try { await groupsApi.rejectMember(groupId, userId); router.back() }
        catch (e) { Alert.alert('Error', extractError(e)) }
      }},
    ])
  }

  const handlePickImage = async () => {
    const url = await pickAndUploadImage(setUploading)
    if (url) setAttachmentUrl(url)
  }

  const submitComment = async () => {
    if (!groupId || !userId) return
    if (!commentText.trim() && !attachmentUrl) return
    setSubmitting(true)
    try {
      await groupsApi.addComment(groupId, userId, { content: commentText.trim() || undefined, attachmentUrl: attachmentUrl || undefined })
      setCommentText('')
      setAttachmentUrl('')
      load()
    } catch (e) {
      Alert.alert('Error', extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* User info */}
        <View style={s.userCard}>
          <Text style={s.userName}>{application?.user.name}</Text>
          <Text style={s.userEmail}>{application?.user.email}</Text>
        </View>

        {/* Approve / Reject */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.approveBtn} onPress={handleApprove}>
            <Text style={s.approveBtnText}>✓ Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.rejectBtn} onPress={handleReject}>
            <Text style={s.rejectBtnText}>✕ Reject</Text>
          </TouchableOpacity>
        </View>

        {/* Application field values */}
        {(application?.fieldValues ?? []).length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Application Details</Text>
            {application!.fieldValues.map(fv => (
              <FieldValue key={fv.fieldId} label={fv.fieldLabel} type={fv.fieldType} value={fv.value} />
            ))}
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.empty}>No application fields were required for this group.</Text>
          </View>
        )}

        {/* Comments */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Comments</Text>
          {comments.length === 0 && <Text style={s.empty}>No comments yet. Add one below.</Text>}
          {comments.map(c => (
            <CommentThread key={c.id} comment={c} groupId={groupId!} userId={userId!} onReplyPosted={load} />
          ))}
        </View>

        {/* New comment box */}
        <View style={s.newCommentBox}>
          <TextInput
            style={s.commentInput}
            placeholder="Write a comment…"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <View style={s.commentActions}>
            <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color="#6b7280" /> : <Text style={s.attachBtnText}>📷</Text>}
            </TouchableOpacity>
            {!!attachmentUrl && <Text style={s.uploadedSmall}>✓ image</Text>}
            <TouchableOpacity style={[s.sendBtn, (!commentText.trim() && !attachmentUrl) && { opacity: 0.5 }]} onPress={submitComment} disabled={submitting || (!commentText.trim() && !attachmentUrl)}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  userCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  userName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  userEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  approveBtn: { flex: 1, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rejectBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  fieldCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  fieldValue: { fontSize: 15, color: '#111827' },
  fieldEmpty: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },
  fieldLink: { fontSize: 13, color: '#2563eb' },
  fieldImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 4 },
  empty: { color: '#9ca3af', fontSize: 14, fontStyle: 'italic' },
  commentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#111827' },
  commentTime: { fontSize: 11, color: '#9ca3af' },
  commentContent: { fontSize: 14, color: '#374151', lineHeight: 20 },
  commentImage: { width: '100%', height: 150, borderRadius: 8, marginTop: 8 },
  replyCard: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#e5e7eb' },
  replyBtn: { marginTop: 8 },
  replyBtnText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  replyBox: { marginTop: 8 },
  replyInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  replyActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  newCommentBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  commentInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 8 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  attachBtnText: { fontSize: 20 },
  uploadedSmall: { fontSize: 12, color: '#16a34a', flex: 1 },
  sendBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})

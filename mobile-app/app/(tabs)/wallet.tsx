import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, FlatList,
  TouchableOpacity, Modal, Alert,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useFocusEffect } from 'expo-router'
import { paymentsApi } from '../../src/api/payments'
import { payoutsApi, Settlement } from '../../src/api/payouts'
import { useAuthStore } from '../../src/store/authStore'
import { extractError } from '../../src/api/client'
import type { Wallet, WalletTransaction } from '../../src/types'
import { TextInput } from 'react-native'

export default function WalletScreen() {
  const { user } = useAuthStore()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [bankAccount, setBankAccount] = useState<Settlement | null>(null)
  const [history, setHistory] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showBankModal, setShowBankModal] = useState(false)
  const [settling, setSettling] = useState(false)

  // Bank form state
  const [holderName, setHolderName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [bankName, setBankName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      paymentsApi.getWallet(),
      payoutsApi.getBankAccount(),
      payoutsApi.getHistory(),
    ])
      .then(([w, ba, hist]) => {
        setWallet(w)
        setBankAccount(ba)
        setHistory(hist)
        if (ba?.accountHolderName) {
          setHolderName(ba.accountHolderName)
          setIfsc(ba.ifscCode ?? '')
          setBankName(ba.bankName ?? '')
        }
      })
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(load)

  const handleSaveBankAccount = async () => {
    if (!holderName || !accountNo || !ifsc) {
      Alert.alert('Required', 'Account holder name, account number and IFSC are required.')
      return
    }
    setSaving(true)
    try {
      const ba = await payoutsApi.saveBankAccount({ accountHolderName: holderName, accountNumber: accountNo, ifscCode: ifsc, bankName })
      setBankAccount(ba)
      setShowBankModal(false)
      Alert.alert('Saved', 'Bank account saved successfully.')
    } catch (e) {
      Alert.alert('Error', extractError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleSettleNow = () => {
    if (!bankAccount?.accountHolderName) {
      Alert.alert('No Bank Account', 'Please add your bank account details first.')
      setShowBankModal(true)
      return
    }
    const balance = wallet?.balance ?? 0
    if (balance <= 0) {
      Alert.alert('No Balance', 'Your wallet balance is ₹0.00.')
      return
    }
    Alert.alert(
      'Settle Now',
      `Transfer ₹${balance.toFixed(2)} to your bank account (${bankAccount.accountNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle', onPress: async () => {
            setSettling(true)
            try {
              const result = await payoutsApi.settleNow()
              if (result.status === 'SUCCESS') {
                Alert.alert('Transfer Initiated', `₹${result.amount?.toFixed(2)} will be credited to your bank account within 1-2 business days.`)
              } else {
                Alert.alert('Transfer Failed', result.failureReason ?? 'Please try again.')
              }
              load()
            } catch (e) {
              Alert.alert('Error', extractError(e))
            } finally {
              setSettling(false)
            }
          }
        },
      ]
    )
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
  if (error) return <View style={s.center}><Text style={s.errorText}>{error}</Text></View>

  const balance = wallet?.balance ?? 0

  return (
    <View style={s.container}>
      {/* Balance card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>Wallet Balance</Text>
        <Text style={s.balanceAmount}>₹{balance.toFixed(2)}</Text>
        <Text style={s.balanceSub}>Earnings from completed rides</Text>
        <View style={s.cardActions}>
          <TouchableOpacity style={s.bankBtn} onPress={() => setShowBankModal(true)}>
            <Text style={s.bankBtnText}>{bankAccount?.accountHolderName ? '✏️ Edit Bank' : '+ Add Bank'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.settleBtn, (balance <= 0 || settling) && s.settleBtnDisabled]}
            onPress={handleSettleNow}
            disabled={balance <= 0 || settling}
          >
            {settling
              ? <ActivityIndicator color="#7c3aed" size="small" />
              : <Text style={s.settleBtnText}>Settle Now →</Text>
            }
          </TouchableOpacity>
        </View>
        {bankAccount?.accountHolderName && (
          <Text style={s.bankInfo}>
            {bankAccount.accountHolderName} · {bankAccount.accountNumber} · {bankAccount.ifscCode}
          </Text>
        )}
      </View>

      {/* Settlement history */}
      {history.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Settlements</Text>
          {history.map(s_ => (
            <View key={s_.settlementId} style={[s.txnCard, { marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.txnRider}>₹{s_.amount?.toFixed(2)} → Bank</Text>
                <Text style={s.txnDate}>{s_.createdAt ? new Date(s_.createdAt).toLocaleString() : ''}</Text>
                {s_.failureReason && <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 2 }}>{s_.failureReason}</Text>}
              </View>
              <View style={[s.settleBadge, s_.status === 'SUCCESS' ? s.badgeSuccess : s_.status === 'FAILED' ? s.badgeFailed : s.badgePending]}>
                <Text style={s.settleBadgeText}>{s_.status}</Text>
              </View>
            </View>
          ))}
          <View style={{ marginBottom: 8 }} />
        </>
      )}

      {/* Payment credit history */}
      <Text style={s.sectionTitle}>Payment History</Text>
      {!wallet?.recentCredits?.length ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>💳</Text>
          <Text style={s.emptyText}>No payments received yet</Text>
          <Text style={s.emptySub}>Payments from riders will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={wallet.recentCredits}
          keyExtractor={(item) => item.paymentId}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }: { item: WalletTransaction }) => (
            <View style={s.txnCard}>
              <View style={s.txnLeft}>
                <Text style={s.txnRider}>{item.riderName}</Text>
                <Text style={s.txnRide} numberOfLines={1}>{item.rideName}</Text>
                <Text style={s.txnDate}>{item.createdAt}</Text>
              </View>
              <Text style={s.txnAmount}>+₹{item.amount.toFixed(2)}</Text>
            </View>
          )}
        />
      )}

      {/* Bank account modal */}
      <Modal visible={showBankModal} animationType="slide" transparent onRequestClose={() => setShowBankModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAwareScrollView style={s.modalSheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" enableOnAndroid>
            <Text style={s.modalTitle}>Bank Account Details</Text>

            <Text style={s.label}>Account Holder Name</Text>
            <TextInput style={s.input} value={holderName} onChangeText={setHolderName} placeholder="e.g. Rahul Sharma" autoCapitalize="words" />

            <Text style={s.label}>Account Number</Text>
            <TextInput style={s.input} value={accountNo} onChangeText={setAccountNo} placeholder="e.g. 1234567890" keyboardType="number-pad" />

            <Text style={s.label}>IFSC Code</Text>
            <TextInput style={s.input} value={ifsc} onChangeText={t => setIfsc(t.toUpperCase())} placeholder="e.g. SBIN0001234" autoCapitalize="characters" />

            <Text style={s.label}>Bank Name (optional)</Text>
            <TextInput style={s.input} value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowBankModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveBankAccount} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#dc2626', fontSize: 15 },
  balanceCard: {
    backgroundColor: '#7c3aed', borderRadius: 20, padding: 24,
    marginBottom: 20,
    shadowColor: '#7c3aed', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  balanceLabel: { color: '#ede9fe', fontSize: 14, fontWeight: '500', marginBottom: 6 },
  balanceAmount: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: 1 },
  balanceSub: { color: '#c4b5fd', fontSize: 12, marginTop: 6, marginBottom: 16 },
  cardActions: { flexDirection: 'row', gap: 10 },
  bankBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bankBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  settleBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  settleBtnDisabled: { opacity: 0.4 },
  settleBtnText: { color: '#7c3aed', fontWeight: '700', fontSize: 13 },
  bankInfo: { color: '#ddd6fe', fontSize: 11, marginTop: 10, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  settleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeFailed: { backgroundColor: '#fee2e2' },
  badgePending: { backgroundColor: '#fef9c3' },
  settleBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  txnCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  txnLeft: { flex: 1, marginRight: 12 },
  txnRider: { fontSize: 15, fontWeight: '600', color: '#111827' },
  txnRide: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  txnDate: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  txnAmount: { fontSize: 17, fontWeight: '700', color: '#16a34a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '500' },
  saveBtn: { flex: 1, backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
})

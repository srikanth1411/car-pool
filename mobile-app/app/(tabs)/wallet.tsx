import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { paymentsApi } from '../../src/api/payments'
import { useAuthStore } from '../../src/store/authStore'
import type { Wallet, WalletTransaction } from '../../src/types'

export default function WalletScreen() {
  const { user } = useAuthStore()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    setLoading(true)
    paymentsApi.getWallet()
      .then(setWallet)
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false))
  }, []))

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />

  if (error) return (
    <View style={s.center}>
      <Text style={s.errorText}>{error}</Text>
    </View>
  )

  return (
    <View style={s.container}>
      {/* Balance card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>Wallet Balance</Text>
        <Text style={s.balanceAmount}>₹{(wallet?.balance ?? 0).toFixed(2)}</Text>
        <Text style={s.balanceSub}>Earnings from completed rides</Text>
      </View>

      {/* Transaction history */}
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
              <View style={s.txnRight}>
                <Text style={s.txnAmount}>+₹{item.amount.toFixed(2)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#dc2626', fontSize: 15 },
  balanceCard: {
    backgroundColor: '#7c3aed', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#7c3aed', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  balanceLabel: { color: '#ede9fe', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  balanceAmount: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: 1 },
  balanceSub: { color: '#c4b5fd', fontSize: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
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
  txnRight: {},
  txnAmount: { fontSize: 17, fontWeight: '700', color: '#16a34a' },
})

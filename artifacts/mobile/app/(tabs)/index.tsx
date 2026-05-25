import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetWalletBalance, getGetWalletBalanceQueryKey,
  useSendMoney,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { TransactionItem } from "@/components/TransactionItem";
import { SectionHeader } from "@/components/SectionHeader";

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [sendVisible, setSendVisible] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const { data: balance } = useGetWalletBalance({
    query: { queryKey: getGetWalletBalanceQueryKey() },
  });

  const sendMoney = useSendMoney();

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
    setRefreshing(false);
  };

  const handleSend = () => {
    if (!recipient || !amount || isNaN(Number(amount))) {
      Alert.alert("Error", "Please enter a valid recipient and amount");
      return;
    }
    sendMoney.mutate(
      { data: { recipientPhone: recipient, amount: Number(amount), currency: "USDC", note } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSendVisible(false);
          setRecipient(""); setAmount(""); setNote("");
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          Alert.alert("Sent!", `$${amount} sent successfully.`);
        },
        onError: (e: any) => {
          Alert.alert("Failed", e?.response?.data?.message ?? "Transfer failed");
        },
      }
    );
  };

  const bal = balance?.balance ?? summary?.walletBalance ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.headerGrad, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Good day</Text>
              <Text style={styles.headerTitle}>My Wallet</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/profile")} testID="button-profile">
              <View style={styles.avatar}>
                <Feather name="user" size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Balance */}
          <View style={styles.balanceBlock}>
            <Text style={styles.balLabel}>Total Balance</Text>
            {isLoading ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
            ) : (
              <Text style={styles.balAmount}>
                ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            )}
            <View style={styles.usdcBadge}>
              <Text style={styles.usdcText}>USDC on Celo</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            {[
              { icon: "send" as const, label: "Send", onPress: () => { Haptics.impactAsync(); setSendVisible(true); } },
              { icon: "plus-circle" as const, label: "Add", onPress: () => router.push("/add-funds") },
              { icon: "arrow-down-circle" as const, label: "Withdraw", onPress: () => router.push("/withdraw") },
              { icon: "more-horizontal" as const, label: "More", onPress: () => {} },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress} testID={`button-${a.label.toLowerCase()}`}>
                <View style={styles.actionIcon}>
                  <Feather name={a.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Recent Transactions */}
        <SectionHeader
          title="Recent Transactions"
          action="See All"
          onAction={() => router.push("/transactions")}
        />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 32 }} />
          ) : summary?.recentTransactions?.length ? (
            summary.recentTransactions.map((tx: any) => (
              <TransactionItem key={tx.id} {...tx} amount={Math.abs(tx.amount)} />
            ))
          ) : (
            <View style={styles.empty}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        {summary && (
          <>
            <SectionHeader title="This Month" />
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: "#22C55E15" }]}>
                  <Feather name="arrow-down-left" size={16} color="#22C55E" />
                </View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Money In</Text>
                <Text style={[styles.statAmount, { color: colors.foreground }]}>
                  ${summary.totalIncoming?.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: "#EF444415" }]}>
                  <Feather name="arrow-up-right" size={16} color="#EF4444" />
                </View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Money Out</Text>
                <Text style={[styles.statAmount, { color: colors.foreground }]}>
                  ${summary.totalOutgoing?.toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Send Money Modal */}
      <Modal visible={sendVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSendVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Money</Text>
          <View style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="phone" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground }]}
              placeholder="Phone or wallet address"
              placeholderTextColor={colors.mutedForeground}
              value={recipient}
              onChangeText={setRecipient}
              testID="input-recipient"
            />
          </View>
          <View style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.inputPrefix, { color: colors.mutedForeground }]}>$</Text>
            <TextInput
              style={[styles.inputText, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              testID="input-amount"
            />
          </View>
          <View style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="message-square" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground }]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={note}
              onChangeText={setNote}
              testID="input-note"
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={sendMoney.isPending}
            testID="button-confirm-send"
          >
            {sendMoney.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>Send Money</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSendVisible(false)} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { paddingHorizontal: 16, paddingBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greeting: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  balanceBlock: { alignItems: "center", marginBottom: 24 },
  balLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  balAmount: { color: "#fff", fontSize: 42, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  usdcBadge: { marginTop: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  usdcText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  quickActions: { flexDirection: "row", justifyContent: "space-around" },
  actionBtn: { alignItems: "center", gap: 6 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modal: { flex: 1, padding: 24, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2EAF4", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8 },
  input: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  inputPrefix: { fontSize: 16, fontFamily: "Inter_500Medium" },
  inputText: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  sendBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  sendBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});

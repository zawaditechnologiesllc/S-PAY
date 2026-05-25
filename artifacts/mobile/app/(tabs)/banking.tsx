import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  useGetBankingAccounts, getGetBankingAccountsQueryKey,
  useGetIncomingPayments, getGetIncomingPaymentsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { SectionHeader } from "@/components/SectionHeader";

export default function BankingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: accounts, isLoading: loadingAccounts } = useGetBankingAccounts({
    query: { queryKey: getGetBankingAccountsQueryKey() },
  });
  const { data: payments, isLoading: loadingPayments } = useGetIncomingPayments({
    query: { queryKey: getGetIncomingPaymentsQueryKey() },
  });

  const copy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  const paymentTypeColor = (t: string) => {
    const m: Record<string, string> = { ach: "#22C55E", wire: "#4DC9EE", sepa: "#8B5CF6", pix: "#F59E0B" };
    return m[t] ?? "#64748B";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.headerGrad, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerSub}>Virtual Accounts</Text>
              <Text style={styles.headerTitle}>Banking</Text>
            </View>
            <TouchableOpacity
              style={[styles.withdrawBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              onPress={() => router.push("/withdraw")}
              testID="button-withdraw"
            >
              <Feather name="arrow-down-circle" size={16} color="#fff" />
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
          {loadingAccounts ? null : (
            <Text style={styles.totalBalance}>
              Total: ${accounts?.totalBalance?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
            </Text>
          )}
        </LinearGradient>

        {/* Accounts */}
        <SectionHeader title="Your Accounts" />
        {loadingAccounts ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 32 }} />
        ) : accounts?.accounts?.length ? (
          accounts.accounts.map((acc: any) => (
            <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.accHeader}>
                <View style={[styles.flagBadge, { backgroundColor: acc.currency === "USD" ? "#4DC9EE15" : "#8B5CF615" }]}>
                  <Text style={[styles.flag, { color: acc.currency === "USD" ? "#4DC9EE" : "#8B5CF6" }]}>
                    {acc.currency}
                  </Text>
                </View>
                <Text style={[styles.accBalance, { color: colors.foreground }]}>
                  {acc.currency} {acc.availableBalance?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <Text style={[styles.bankName, { color: colors.mutedForeground }]}>{acc.bankName}</Text>

              {acc.accountNumber && (
                <TouchableOpacity
                  style={[styles.infoRow, { borderColor: colors.border }]}
                  onPress={() => copy(acc.accountNumber, "Account number")}
                  testID={`button-copy-account-${acc.id}`}
                >
                  <View>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Account Number</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{acc.accountNumber}</Text>
                  </View>
                  <Feather name="copy" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
              {acc.routingNumber && (
                <TouchableOpacity
                  style={[styles.infoRow, { borderColor: colors.border }]}
                  onPress={() => copy(acc.routingNumber, "Routing number")}
                  testID={`button-copy-routing-${acc.id}`}
                >
                  <View>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Routing Number</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{acc.routingNumber}</Text>
                  </View>
                  <Feather name="copy" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
              {acc.iban && (
                <TouchableOpacity
                  style={[styles.infoRow, { borderColor: colors.border }]}
                  onPress={() => copy(acc.iban, "IBAN")}
                  testID={`button-copy-iban-${acc.id}`}
                >
                  <View>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>IBAN</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{acc.iban}</Text>
                  </View>
                  <Feather name="copy" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
              <View style={[styles.accTypeBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.accTypeText, { color: colors.mutedForeground }]}>
                  {acc.accountType?.toUpperCase()} · {acc.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <Feather name="grid" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No accounts yet</Text>
          </View>
        )}

        {/* Incoming Payments */}
        <SectionHeader title="Incoming Payments" />
        <View style={[styles.paymentsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {loadingPayments ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
          ) : payments?.payments?.length ? (
            payments.payments.map((p: any) => (
              <View key={p.id} style={[styles.paymentRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.payTypeIcon, { backgroundColor: `${paymentTypeColor(p.paymentType)}15` }]}>
                  <Feather name="arrow-down-left" size={16} color={paymentTypeColor(p.paymentType)} />
                </View>
                <View style={styles.payInfo}>
                  <Text style={[styles.payFrom, { color: colors.foreground }]}>{p.sender}</Text>
                  <Text style={[styles.paySub, { color: colors.mutedForeground }]}>
                    {p.paymentType?.toUpperCase()} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
                <Text style={[styles.payAmt, { color: "#22C55E" }]}>
                  +{p.currency} {p.amount?.toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No incoming payments</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { paddingHorizontal: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  totalBalance: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontFamily: "Inter_500Medium" },
  withdrawBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  withdrawText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  accountCard: { marginHorizontal: 16, marginVertical: 6, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  accHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flagBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  flag: { fontSize: 13, fontFamily: "Inter_700Bold" },
  accBalance: { fontSize: 20, fontFamily: "Inter_700Bold" },
  bankName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 10 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  accTypeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  accTypeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  paymentsCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  paymentRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1 },
  payTypeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  payInfo: { flex: 1 },
  payFrom: { fontSize: 14, fontFamily: "Inter_500Medium" },
  paySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  payAmt: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});

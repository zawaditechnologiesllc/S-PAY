import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useInitiateWithdraw, useGetExchangeRates, getGetExchangeRatesQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const METHODS = [
  { id: "mpesa", label: "M-Pesa", currency: "KES", icon: "smartphone" as const, flag: "🇰🇪" },
  { id: "sepa", label: "SEPA Wire", currency: "EUR", icon: "globe" as const, flag: "🇪🇺" },
  { id: "pix", label: "PIX (Brazil)", currency: "BRL", icon: "zap" as const, flag: "🇧🇷" },
  { id: "bank_transfer", label: "Bank Transfer", currency: "USD", icon: "credit-card" as const, flag: "🏦" },
];

export default function WithdrawScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: rateData } = useGetExchangeRates(
    { source: "USD", target: method.currency },
    { query: { queryKey: getGetExchangeRatesQueryKey({ source: "USD", target: method.currency }) } }
  );

  const withdraw = useInitiateWithdraw();

  const localAmount = rateData?.rate && amount
    ? ((Number(amount) * (1 - (rateData.fee ?? 0.005))) * rateData.rate).toFixed(2)
    : null;

  const handleWithdraw = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount");
      return;
    }
    withdraw.mutate(
      {
        data: {
          amount: Number(amount),
          sourceCurrency: "USD",
          targetCurrency: method.currency,
          method: method.id as any,
          recipientPhone: method.id === "mpesa" ? recipient : undefined,
          recipientIban: method.id === "sepa" ? recipient : undefined,
        },
      },
      {
        onSuccess: (data: any) => {
          Alert.alert(
            "Withdrawal Initiated",
            `${data.localAmount?.toFixed(2)} ${data.localCurrency} will arrive ${data.estimatedArrival}.`,
            [{ text: "Done", onPress: () => router.back() }]
          );
        },
        onError: (e: any) => {
          Alert.alert("Failed", e?.response?.data?.message ?? "Withdrawal failed");
        },
      }
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: bottomPad + 24, paddingHorizontal: 16, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="button-back">
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.foreground }]}>Withdraw Funds</Text>

      {/* Method Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Select Method</Text>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.methodRow,
              { borderColor: method.id === m.id ? colors.primary : colors.border, backgroundColor: colors.card },
            ]}
            onPress={() => setMethod(m)}
            testID={`button-method-${m.id}`}
          >
            <Text style={styles.methodFlag}>{m.flag}</Text>
            <View style={styles.methodInfo}>
              <Text style={[styles.methodName, { color: colors.foreground }]}>{m.label}</Text>
              <Text style={[styles.methodCurrency, { color: colors.mutedForeground }]}>Receives in {m.currency}</Text>
            </View>
            {method.id === m.id && <Feather name="check-circle" size={20} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Amount (USD)</Text>
        <View style={[styles.amountBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.amtPrefix, { color: colors.mutedForeground }]}>$</Text>
          <TextInput
            style={[styles.amtInput, { color: colors.foreground }]}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            testID="input-amount"
          />
          <Text style={[styles.amtSuffix, { color: colors.mutedForeground }]}>USD</Text>
        </View>
        {rateData && amount ? (
          <View style={[styles.rateBox, { backgroundColor: colors.muted }]}>
            <Feather name="trending-up" size={14} color={colors.primary} />
            <Text style={[styles.rateText, { color: colors.mutedForeground }]}>
              Rate: 1 USD = {rateData.rate} {method.currency} · Fee: {((rateData.fee ?? 0.005) * 100).toFixed(1)}%
            </Text>
          </View>
        ) : null}
        {localAmount && (
          <View style={[styles.receiveBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Text style={[styles.receiveText, { color: "#15803D" }]}>
              You receive ≈ {localAmount} {method.currency}
            </Text>
          </View>
        )}
      </View>

      {/* Recipient */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {method.id === "mpesa" ? "M-Pesa Phone Number" : method.id === "sepa" ? "IBAN" : "Recipient Info"}
        </Text>
        <View style={[styles.recipientBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name={method.icon} size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.recipientInput, { color: colors.foreground }]}
            placeholder={method.id === "mpesa" ? "+254 712 345 678" : method.id === "sepa" ? "IBAN number" : "Account details"}
            placeholderTextColor={colors.mutedForeground}
            value={recipient}
            onChangeText={setRecipient}
            testID="input-recipient"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={handleWithdraw}
        disabled={withdraw.isPending}
        testID="button-confirm-withdraw"
      >
        {withdraw.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Confirm Withdrawal</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: { padding: 4, alignSelf: "flex-start" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  section: { gap: 10 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 14, padding: 14 },
  methodFlag: { fontSize: 24 },
  methodInfo: { flex: 1 },
  methodName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  methodCurrency: { fontSize: 12, fontFamily: "Inter_400Regular" },
  amountBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  amtPrefix: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  amtInput: { flex: 1, fontSize: 28, fontFamily: "Inter_700Bold" },
  amtSuffix: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rateBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  rateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  receiveBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  receiveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  recipientBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  recipientInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

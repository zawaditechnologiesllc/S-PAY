import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  useGetCardDetails, getGetCardDetailsQueryKey,
  useGetCardTransactions, getGetCardTransactionsQueryKey,
  useGetSpendingSummary, getGetSpendingSummaryQueryKey,
  useJoinCardWaitlist, useIssueCard, useGetMe, getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { SectionHeader } from "@/components/SectionHeader";

export default function CardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: cardData, isLoading: loadingCard, refetch: refetchCard } = useGetCardDetails({
    query: { queryKey: getGetCardDetailsQueryKey() },
  });
  const { data: transactions, isLoading: loadingTxns } = useGetCardTransactions(
    undefined,
    { query: { queryKey: getGetCardTransactionsQueryKey() } },
  );
  const { data: spending } = useGetSpendingSummary(
    undefined,
    { query: { queryKey: getGetSpendingSummaryQueryKey() } },
  );
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const joinWaitlist = useJoinCardWaitlist();
  const issueCard = useIssueCard();

  const handleJoinWaitlist = () => {
    joinWaitlist.mutate(undefined, {
      onSuccess: (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("You're on the list!", data?.message ?? "We'll notify you when S-PAY Card launches.");
        refetchCard();
      },
    });
  };

  const handleCreateCard = () => {
    issueCard.mutate(undefined as never, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Card created 🎉", "Your S-PAY virtual card is ready to use.");
        refetchCard();
      },
      onError: (e: any) => {
        Alert.alert("Card not created", e?.response?.data?.message ?? "Please try again.");
      },
    });
  };

  const isNotIssued = cardData?.cardStatus === "not_issued";
  const kycApproved = me?.kycStatus === "approved";

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
          <Text style={styles.headerSub}>Virtual Card</Text>
          <Text style={styles.headerTitle}>My Cards</Text>
        </LinearGradient>

        {/* Coming Soon Banner */}
        {cardData?.isComingSoon && (
          <View style={[styles.comingSoonBanner, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
            <Feather name="clock" size={18} color="#F59E0B" />
            <Text style={[styles.comingSoonText, { color: "#92400E" }]}>
              S-PAY virtual cards are launching soon. Join the waitlist for early access.
            </Text>
          </View>
        )}

        {/* Cards Preview */}
        {loadingCard ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 32 }} />
        ) : cardData?.cards?.length ? (
          <>
            <SectionHeader title="My Cards" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
              {cardData.cards.map((card: any) => (
                <LinearGradient
                  key={card.id}
                  colors={card.network === "visa" ? ["#1A2B4A", "#2D4A7A"] : ["#1A1A2E", "#16213E"]}
                  style={styles.cardWidget}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardLabel}>{card.label}</Text>
                    <Text style={styles.cardNetwork}>{card.network?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.cardNumber}>•••• •••• •••• {card.last4}</Text>
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardFieldLabel}>Expires</Text>
                      <Text style={styles.cardField}>{String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}</Text>
                    </View>
                    <View>
                      <Text style={styles.cardFieldLabel}>Status</Text>
                      <Text style={[styles.cardField, { color: card.status === "active" ? "#22C55E" : "#F59E0B" }]}>{card.status}</Text>
                    </View>
                  </View>
                </LinearGradient>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Waitlist CTA (program off) */}
        {cardData?.isComingSoon && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            {cardData?.onWaitlist ? (
              <View style={[styles.waitlistBtn, { backgroundColor: colors.muted }]}>
                <Feather name="check-circle" size={18} color="#22C55E" />
                <Text style={[styles.waitlistBtnText, { color: colors.foreground }]}>You're on the waitlist</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.waitlistBtn, { backgroundColor: colors.primary }]}
                onPress={handleJoinWaitlist}
                disabled={joinWaitlist.isPending}
                testID="button-join-waitlist"
              >
                {joinWaitlist.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="bell" size={18} color="#fff" />
                    <Text style={styles.waitlistBtnText}>Get Early Access</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Create card CTA (program live, no card yet) */}
        {!loadingCard && isNotIssued && (
          <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 10 }}>
            <View style={[styles.comingSoonBanner, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", marginHorizontal: 0, marginTop: 0 }]}>
              <Feather name="zap" size={18} color="#22C55E" />
              <Text style={[styles.comingSoonText, { color: "#166534" }]}>
                The S-PAY card program is live! Create your virtual Visa and spend your balance worldwide.
              </Text>
            </View>
            {kycApproved ? (
              <TouchableOpacity
                style={[styles.waitlistBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateCard}
                disabled={issueCard.isPending}
                testID="button-create-card"
              >
                {issueCard.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="credit-card" size={18} color="#fff" />
                    <Text style={styles.waitlistBtnText}>Create My Virtual Card</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.comingSoonBanner, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", marginHorizontal: 0, marginTop: 0 }]}>
                <Feather name="shield" size={18} color="#F59E0B" />
                <Text style={[styles.comingSoonText, { color: "#92400E" }]}>
                  Complete identity verification (KYC) in your profile to unlock your card.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Spending Summary */}
        {spending?.categories?.length ? (
          <>
            <SectionHeader title="Monthly Spending" />
            <View style={[styles.spendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.spendTotal, { color: colors.foreground }]}>
                ${spending.totalSpent?.toFixed(2)} this month
              </Text>
              {spending.categories.map((cat: any) => (
                <View key={cat.category} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color ?? colors.primary }]} />
                  <Text style={[styles.catName, { color: colors.foreground }]}>{cat.category}</Text>
                  <View style={styles.catBarBg}>
                    <View style={[styles.catBar, { width: `${cat.percentage}%`, backgroundColor: cat.color ?? colors.primary }]} />
                  </View>
                  <Text style={[styles.catPct, { color: colors.mutedForeground }]}>{cat.percentage?.toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Recent Card Transactions */}
        <SectionHeader title="Recent Transactions" />
        <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {loadingTxns ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
          ) : transactions?.transactions?.length ? (
            transactions.transactions.map((tx: any) => (
              <View key={tx.id} style={[styles.txRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.txIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="shopping-bag" size={16} color={colors.primary} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={[styles.txMerchant, { color: colors.foreground }]}>{tx.merchantName}</Text>
                  <Text style={[styles.txCat, { color: colors.mutedForeground }]}>
                    {tx.category} · {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
                <Text style={[styles.txAmt, { color: "#EF4444" }]}>-${tx.amount?.toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Feather name="credit-card" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No card transactions yet</Text>
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
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  comingSoonBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 16, marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 14 },
  comingSoonText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  cardsScroll: { marginTop: 4 },
  cardWidget: { width: 280, borderRadius: 18, padding: 20, gap: 16 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  cardLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_500Medium" },
  cardNetwork: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  cardNumber: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  cardBottom: { flexDirection: "row", gap: 32 },
  cardFieldLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_400Regular" },
  cardField: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  waitlistBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  waitlistBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  spendCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  spendTotal: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: 13, fontFamily: "Inter_400Regular", width: 90 },
  catBarBg: { flex: 1, height: 6, backgroundColor: "#E2EAF4", borderRadius: 3, overflow: "hidden" },
  catBar: { height: 6, borderRadius: 3 },
  catPct: { fontSize: 12, fontFamily: "Inter_500Medium", width: 36, textAlign: "right" },
  txCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontFamily: "Inter_500Medium" },
  txCat: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  txAmt: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface BalanceCardProps {
  balance: number;
  currency: string;
  onSend?: () => void;
  onAdd?: () => void;
  onWithdraw?: () => void;
}

export function BalanceCard({ balance, currency, onSend, onAdd, onWithdraw }: BalanceCardProps) {
  const colors = useColors();

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USD" || currency === "USDC" ? "USD" : "USD",
    minimumFractionDigits: 2,
  }).format(balance);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.label}>Total Balance</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>USDC</Text>
        </View>
      </View>
      <Text style={styles.amount}>{formatted}</Text>
      <Text style={styles.subText}>Available for transactions</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onSend} testID="button-send">
          <View style={styles.actionIcon}>
            <Feather name="send" size={18} color="#4DC9EE" />
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onAdd} testID="button-add">
          <View style={styles.actionIcon}>
            <Feather name="plus" size={18} color="#4DC9EE" />
          </View>
          <Text style={styles.actionLabel}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onWithdraw} testID="button-withdraw">
          <View style={styles.actionIcon}>
            <Feather name="arrow-down-circle" size={18} color="#4DC9EE" />
          </View>
          <Text style={styles.actionLabel}>Withdraw</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  amount: {
    color: "#FFFFFF",
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});

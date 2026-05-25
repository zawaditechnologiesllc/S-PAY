import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface TransactionItemProps {
  type: "send" | "receive" | "withdraw" | "recharge" | "payment";
  amount: number;
  currency: string;
  description: string;
  counterparty?: string | null;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

const typeConfig = {
  receive: { icon: "arrow-down-left" as const, color: "#22C55E", label: "Received", sign: "+" },
  send: { icon: "arrow-up-right" as const, color: "#EF4444", label: "Sent", sign: "-" },
  withdraw: { icon: "arrow-down-circle" as const, color: "#F59E0B", label: "Withdrawal", sign: "-" },
  recharge: { icon: "zap" as const, color: "#8B5CF6", label: "Recharge", sign: "-" },
  payment: { icon: "shopping-bag" as const, color: "#EC4899", label: "Payment", sign: "-" },
};

export function TransactionItem({ type, amount, currency, description, counterparty, status, createdAt }: TransactionItemProps) {
  const colors = useColors();
  const config = typeConfig[type] ?? typeConfig.payment;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absAmount);
  const date = new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View style={[styles.item, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
        <Feather name={config.icon} size={18} color={config.color} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.desc, { color: colors.foreground }]} numberOfLines={1}>{description}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{counterparty ?? config.label} · {date}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: config.color }]}>
          {config.sign}{formatted}
        </Text>
        <Text style={[styles.currency, { color: colors.mutedForeground }]}>{currency}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  currency: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

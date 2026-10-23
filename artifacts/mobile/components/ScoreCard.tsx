import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGetMyScore, getGetMyScoreQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { ScoreGauge } from "@/components/ScoreGauge";

/** Home-tab S-PAY Score card (personal + business) — opens the full score screen. */
export function ScoreCard() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, isError } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey() } });

  if (isError || (data && !data.programEnabled)) return null;
  const title = data?.accountType === "business" ? "Business Score" : "S-PAY Score";
  const top = data?.improvements?.[0];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/score")}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID="card-score"
    >
      <View style={styles.header}>
        <Feather name="activity" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </View>
      {isLoading || !data ? (
        <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
      ) : !data.enabled ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>Your score is off. Tap to turn it on and start building your track record.</Text>
      ) : (
        <View style={styles.row}>
          <ScoreGauge score={data.score} width={130} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={[styles.muted, { color: colors.mutedForeground }]} numberOfLines={3}>{data.band?.summary}</Text>
            {data.nextBand && (
              <Text style={[styles.next, { color: colors.foreground }]}>{data.nextBand.pointsNeeded} pts to {data.nextBand.label}</Text>
            )}
            {top && (
              <View style={[styles.tip, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tipText, { color: colors.foreground }]} numberOfLines={2}>{top.title}</Text>
                {top.estimatedPoints !== null && <Text style={[styles.tipPts, { color: "#256ABF" }]}>+{top.estimatedPoints}</Text>}
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  muted: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  next: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tipPts: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

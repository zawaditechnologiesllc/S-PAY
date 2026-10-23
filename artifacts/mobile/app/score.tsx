import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform, Share, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyScore, getGetMyScoreQueryKey, useUpdateScoreSettings, useDeleteScoreHistory, useCreateScoreShare,
  useStartKyc, useResendVerification, exportScoreData,
  type ScoreImprovement, type ScoreView,
} from "@workspace/api-client-react";
import { SCORE_BAND_PERKS, SCORE_PARTNER_SHARING_NOTICE, SCORE_PARTNER_SHARING_TARGET_YEAR, type ScoreBandKey } from "@workspace/score-model";
import { useColors } from "@/hooks/useColors";
import { ScoreGauge } from "@/components/ScoreGauge";

const SITE = "https://spayewallet.com";
const MARK = "#256ABF";   // single-series mark (score ramp)
const TRACK = "#E3EDF9";  // lighter step of the same ramp

// Web paths the plan links to → the screens that exist in the app (the rest open on the web).
const MOBILE_ROUTES: Record<string, string> = {
  "/security": "/security", "/profile": "/profile", "/banking": "/(tabs)/banking", "/wallet": "/(tabs)", "/dashboard": "/(tabs)",
};

const errMessage = (e: unknown, fallback: string) =>
  (e as { data?: { message?: string } })?.data?.message ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export default function ScoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey() } });
  const update = useUpdateScoreSettings();
  const del = useDeleteScoreHistory();
  const share = useCreateScoreShare();
  const startKyc = useStartKyc();
  const resend = useResendVerification();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const title = data?.accountType === "business" ? "Business Score" : "S-PAY Score";
  const setView = (v: ScoreView) => qc.setQueryData(getGetMyScoreQueryKey(), v);

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() });
    setRefreshing(false);
  };

  const settings = (body: { enabled?: boolean; partnerSharing?: boolean }) =>
    update.mutate({ data: body }, { onSuccess: setView, onError: (e) => Alert.alert("Couldn't update", errMessage(e, "Please try again.")) });

  const runAction = (i: ScoreImprovement) => {
    const a = i.action;
    if (!a) return;
    if (a.kind === "kyc") {
      startKyc.mutate(undefined, {
        onSuccess: (r) => {
          const d = r as { verificationUrl?: string; message?: string };
          if (d.verificationUrl) WebBrowser.openBrowserAsync(d.verificationUrl);
          else Alert.alert("Identity verification", d.message ?? "You're all set.");
        },
        onError: (e) => Alert.alert("Identity verification", errMessage(e, "Verification is activating soon.")),
      });
    } else if (a.kind === "email") {
      resend.mutate(undefined, { onSuccess: () => Alert.alert("Confirmation email", "Sent — check your inbox.") });
    } else if (a.href) {
      const route = MOBILE_ROUTES[a.href];
      if (route) router.push(route as never);
      else WebBrowser.openBrowserAsync(`${SITE}${a.href}`);
    }
  };

  const confirmOff = () => Alert.alert(
    "Turn off your S-PAY Score?",
    "We'll stop calculating and collecting anything for your score, and partner sharing switches off too. Stored snapshots stay until you delete them.",
    [{ text: "Keep it on", style: "cancel" }, { text: "Turn off", style: "destructive", onPress: () => settings({ enabled: false }) }],
  );
  const confirmSharing = () => Alert.alert(
    "Partner sharing",
    `${SCORE_PARTNER_SHARING_NOTICE}\n\nScore Data Notice version ${data?.partnerSharing.currentVersion}.`,
    [{ text: "Not now", style: "cancel" }, { text: "I agree", onPress: () => settings({ partnerSharing: true }) }],
  );
  const confirmDelete = () => Alert.alert(
    "Delete your score history?",
    "This permanently erases your monthly snapshots. It can't be undone.",
    [{ text: "Cancel", style: "cancel" }, {
      text: "Delete", style: "destructive",
      onPress: () => del.mutate(undefined, {
        onSuccess: (r) => { Alert.alert("Deleted", r.message); qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() }); },
        onError: (e) => Alert.alert("Couldn't delete", errMessage(e, "Please try again.")),
      }),
    }],
  );
  const shareProof = (exact: boolean) => share.mutate({ data: { showExactScore: exact, days: 7 } }, {
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() });
      Share.share({ message: `My verified ${title}: ${s.url}`, url: s.url });
    },
    onError: (e) => Alert.alert("Couldn't create link", errMessage(e, "Please try again.")),
  });
  const download = async () => {
    try {
      const json = await exportScoreData();
      await Share.share({ title: "S-PAY Score data", message: JSON.stringify(json, null, 2) });
    } catch (e) {
      Alert.alert("Download failed", errMessage(e, "Please try again."));
    }
  };

  const perks = data?.band ? SCORE_BAND_PERKS[data.band.key as ScoreBandKey] : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[s.header, { paddingTop: topPad + 12 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} testID="button-back"><Feather name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${SITE}/score`)} accessibilityLabel="How it works"><Feather name="info" size={20} color="#fff" /></TouchableOpacity>
        </View>
      </LinearGradient>

      {isLoading || !data ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !data.programEnabled ? (
        <Card><Text style={[s.body, { color: colors.mutedForeground }]}>S-PAY Score is temporarily paused for everyone. Your history and choices are kept.</Text></Card>
      ) : (
        <>
          <Card style={{ marginTop: -24, alignItems: "center" }}>
            {data.enabled ? (
              <>
                <ScoreGauge score={data.score} width={240} />
                <Text style={[s.body, { color: colors.mutedForeground, textAlign: "center", marginTop: 10 }]}>{data.band?.summary}</Text>
                {data.nextBand && (
                  <Text style={[s.small, { color: colors.foreground, marginTop: 6 }]}>
                    <Text style={{ fontFamily: "Inter_700Bold" }}>{data.nextBand.pointsNeeded} pts</Text> to {data.nextBand.label} ({data.nextBand.min})
                  </Text>
                )}
                {data.percentile !== null && <Text style={[s.small, { color: colors.mutedForeground, marginTop: 4 }]}>Higher than {data.percentile}% of members</Text>}
              </>
            ) : (
              <>
                <Text style={[s.h2, { color: colors.foreground }]}>Your score is off</Text>
                <Text style={[s.body, { color: colors.mutedForeground, textAlign: "center", marginVertical: 8 }]}>Nothing is calculated or collected. Turn it on to see your score and a plan to raise it.</Text>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => settings({ enabled: true })}><Text style={s.btnText}>Turn on my score</Text></TouchableOpacity>
              </>
            )}
          </Card>

          {data.enabled && data.improvements.length > 0 && (
            <Card>
              <Text style={[s.h2, { color: colors.foreground }]}>Raise your score</Text>
              {data.improvements.map((i) => (
                <TouchableOpacity key={i.key} style={[s.row, { borderBottomColor: colors.border }]} onPress={() => runAction(i)} disabled={!i.action}>
                  <View style={[s.pts, { backgroundColor: colors.muted }]}>
                    <Text style={[s.ptsText, { color: colors.foreground }]}>{i.estimatedPoints !== null ? `+${i.estimatedPoints}` : "Time"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: colors.foreground }]}>{i.title}</Text>
                    <Text style={[s.small, { color: colors.mutedForeground }]}>{i.description}</Text>
                  </View>
                  {i.action && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                </TouchableOpacity>
              ))}
            </Card>
          )}

          {data.enabled && data.factors.length > 0 && (
            <Card>
              <Text style={[s.h2, { color: colors.foreground }]}>What's behind your score</Text>
              {data.factors.map((f) => (
                <View key={f.key} style={{ marginTop: 12 }}>
                  <View style={s.factorHead}>
                    <Text style={[s.rowTitle, { color: colors.foreground }]}>{f.label} <Text style={[s.small, { color: colors.mutedForeground }]}>· {Math.round(f.weight * 100)}%</Text></Text>
                    <Text style={[s.rowTitle, { color: colors.foreground }]}>{f.points}<Text style={{ color: colors.mutedForeground }}>/{f.maxPoints}</Text></Text>
                  </View>
                  <View style={[s.track, { backgroundColor: TRACK }]}><View style={[s.fill, { width: `${f.value}%`, backgroundColor: MARK }]} /></View>
                  <Text style={[s.small, { color: colors.mutedForeground, marginTop: 4 }]}>{f.detail}</Text>
                </View>
              ))}
            </Card>
          )}

          {data.enabled && data.history.length > 0 && (
            <Card>
              <Text style={[s.h2, { color: colors.foreground }]}>Score history</Text>
              {[...data.history].reverse().map((h) => (
                <View key={h.period} style={[s.histRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.small, { color: colors.mutedForeground }]}>{h.period}</Text>
                  <Text style={[s.rowTitle, { color: colors.foreground }]}>{h.score} <Text style={[s.small, { color: colors.mutedForeground }]}>{h.bandLabel}</Text></Text>
                </View>
              ))}
            </Card>
          )}

          {data.enabled && perks && (
            <Card>
              <Text style={[s.h2, { color: colors.foreground }]}>Your {data.band?.label} benefits</Text>
              {perks.live.map((p) => <Text key={p} style={[s.small, { color: colors.foreground, marginTop: 6 }]}>✓ {p}</Text>)}
              {perks.planned.map((p) => <Text key={p} style={[s.small, { color: colors.mutedForeground, marginTop: 6 }]}>◷ {p} (planned)</Text>)}
            </Card>
          )}

          {data.enabled && data.score !== null && (
            <Card>
              <Text style={[s.h2, { color: colors.foreground }]}>Share proof of your score</Text>
              <Text style={[s.small, { color: colors.mutedForeground, marginVertical: 6 }]}>A verified link that expires in 7 days. They see your first name, band and — if you choose — your exact score.</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => shareProof(false)} disabled={share.isPending}><Text style={s.btnText}>Share band</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.foreground, flex: 1 }]} onPress={() => shareProof(true)} disabled={share.isPending}><Text style={s.btnText}>Share score</Text></TouchableOpacity>
              </View>
            </Card>
          )}

          <Card>
            <Text style={[s.h2, { color: colors.foreground }]}>Your data & controls</Text>
            <View style={[s.ctrl, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.foreground }]}>S-PAY Score</Text>
                <Text style={[s.small, { color: colors.mutedForeground }]}>{data.enabled ? "On — one snapshot a month" : "Off — nothing collected"}</Text>
              </View>
              <Switch value={data.enabled} onValueChange={(on) => (on ? settings({ enabled: true }) : confirmOff())} disabled={update.isPending} />
            </View>
            <View style={[s.ctrl, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.foreground }]}>Partner sharing (from ~{SCORE_PARTNER_SHARING_TARGET_YEAR})</Text>
                <Text style={[s.small, { color: colors.mutedForeground }]}>{data.partnerSharing.consented ? "On — nothing is shared today" : "Off (default) — opt-in only"}</Text>
              </View>
              <Switch value={data.partnerSharing.consented} onValueChange={(on) => (on ? confirmSharing() : settings({ partnerSharing: false }))} disabled={update.isPending || !data.enabled} />
            </View>
            <TouchableOpacity style={[s.ctrl, { borderBottomColor: colors.border }]} onPress={download}>
              <Text style={[s.rowTitle, { color: colors.foreground, flex: 1 }]}>Download my score data</Text>
              <Feather name="download" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrl, { borderBottomColor: "transparent" }]} onPress={confirmDelete} disabled={data.history.length === 0}>
              <Text style={[s.rowTitle, { color: colors.destructive, flex: 1 }]}>Delete my score history ({data.history.length})</Text>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${SITE}/score#your-data`)}>
              <Text style={[s.small, { color: colors.primary, marginTop: 10 }]}>What we collect, why, and how to keep your score high →</Text>
            </TouchableOpacity>
          </Card>

          <Text style={[s.small, { color: colors.mutedForeground, marginHorizontal: 20, marginTop: 12 }]}>
            {title} is S-PAY's own score, built only from your S-PAY activity. It isn't a credit-bureau report, isn't shared with any lender today, and is never used to freeze your money.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  card: { marginHorizontal: 16, marginTop: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  h2: { fontSize: 16, fontFamily: "Inter_700Bold" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pts: { minWidth: 48, alignItems: "center", borderRadius: 8, paddingVertical: 5 },
  ptsText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  factorHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  histRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  ctrl: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

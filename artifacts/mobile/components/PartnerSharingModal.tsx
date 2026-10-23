import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyScore, getGetMyScoreQueryKey, useUpdateScoreSettings, useRecordPartnerPrompt, type ScoreView,
} from "@workspace/api-client-react";
import { SCORE_PARTNER_SHARING_NOTICE, SCORE_PARTNER_SHARING_TARGET_YEAR, partnerSharingBenefits } from "@workspace/score-model";
import { useColors } from "@/hooks/useColors";

const ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  "Credit based on your real record": "credit-card",
  "Working capital for your business": "briefcase",
  "Better terms as your score grows": "trending-up",
  "Insurance and more": "shield",
  "First to hear when offers launch": "bell",
  "You stay in control": "lock",
};

/**
 * Partner-sharing consent sheet — what opting in unlocks, the full notice, and
 * equally weighted "Turn on" / "Not now". mode "reminder" (weekly prompt) adds
 * "Don't ask me again" and records the opt-in with source "prompt".
 */
export function PartnerSharingModal({ visible, onClose, view, mode }: {
  visible: boolean;
  onClose: () => void;
  view: ScoreView;
  mode: "reminder" | "settings";
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const update = useUpdateScoreSettings();
  const prompt = useRecordPartnerPrompt();
  const [showNotice, setShowNotice] = useState(false);
  const business = view.accountType === "business";

  const accept = () => update.mutate({ data: { partnerSharing: true, source: mode === "reminder" ? "prompt" : "settings" } }, {
    onSuccess: (v) => {
      qc.setQueryData(getGetMyScoreQueryKey(), v);
      onClose();
      Alert.alert("Partner sharing is on", `Nothing is shared until the partner program launches (~${SCORE_PARTNER_SHARING_TARGET_YEAR}). You'll hear first when offers go live.`);
    },
    onError: () => Alert.alert("Couldn't turn it on", "Please try again."),
  });
  const never = () => prompt.mutate({ data: { action: "never" } }, {
    onSuccess: (v) => { qc.setQueryData(getGetMyScoreQueryKey(), v); onClose(); },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={s.page}>
        <View style={s.handle} />
        <View style={[s.iconWrap, { backgroundColor: colors.muted }]}><Feather name="users" size={22} color="#2E8FD6" /></View>
        <Text style={[s.title, { color: colors.foreground }]}>
          {business ? "Unlock business financing with your Business Score" : "Unlock fairer credit with your S-PAY Score"}
        </Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>
          Switch on partner sharing and, from ~{SCORE_PARTNER_SHARING_TARGET_YEAR}, licensed banks, lenders and insurers can make you offers based on your real track record on S-PAY.
        </Text>
        {view.score !== null && view.band && (
          <View style={[s.scoreRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.small, { color: colors.mutedForeground }]}>Your score today</Text>
            <Text style={[s.bold, { color: colors.foreground }]}>{view.score} · {view.band.label}</Text>
          </View>
        )}
        {partnerSharingBenefits(business ? "business" : "personal").map((b) => (
          <View key={b.title} style={s.benefit}>
            <View style={[s.bIcon, { backgroundColor: colors.muted }]}><Feather name={ICONS[b.title] ?? "check"} size={15} color="#2E8FD6" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.bold, { color: colors.foreground }]}>{b.title}</Text>
              <Text style={[s.small, { color: colors.mutedForeground }]}>{b.description}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setShowNotice((x) => !x)} style={[s.notice, { borderColor: colors.border }]}>
          <Text style={[s.bold, { color: colors.foreground, fontSize: 12 }]}>What you're agreeing to {showNotice ? "▴" : "▾"}</Text>
          {showNotice && (
            <Text style={[s.small, { color: colors.mutedForeground, marginTop: 6 }]}>
              {SCORE_PARTNER_SHARING_NOTICE}{"\n\n"}Score Data Notice version {view.partnerSharing.currentVersion}.
            </Text>
          )}
        </TouchableOpacity>
        <View style={s.buttons}>
          <TouchableOpacity style={[s.btn, s.btnOutline, { borderColor: colors.border }]} onPress={onClose} disabled={update.isPending}>
            <Text style={[s.btnText, { color: colors.foreground }]}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={accept} disabled={update.isPending} testID="button-partner-optin">
            {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: "#fff" }]}>Turn on sharing</Text>}
          </TouchableOpacity>
        </View>
        {mode === "reminder" && (
          <>
            <TouchableOpacity onPress={never} disabled={prompt.isPending} style={{ alignSelf: "center", padding: 8 }}>
              <Text style={[s.small, { color: colors.mutedForeground, textDecorationLine: "underline" }]}>Don't ask me again</Text>
            </TouchableOpacity>
            <Text style={[s.small, { color: colors.mutedForeground, textAlign: "center" }]}>
              We remind you at most once every {view.partnerPrompt.intervalDays} days. Off by default · switch it off any time.
            </Text>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

/** Weekly reminder for members who haven't opted in — mounted on the home tab. */
export function PartnerSharingReminder() {
  const qc = useQueryClient();
  const { data } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey() } });
  const prompt = useRecordPartnerPrompt();
  const [snapshot, setSnapshot] = useState<ScoreView | null>(null);
  const [visible, setVisible] = useState(false);
  const latest = useRef(data);
  latest.current = data;
  const due = data?.partnerPrompt?.due === true;

  useEffect(() => {
    if (!due) return;
    const t = setTimeout(() => {
      if (!latest.current) return;
      setSnapshot(latest.current);
      setVisible(true);
      prompt.mutate({ data: { action: "shown" } }, { onSuccess: (v) => qc.setQueryData(getGetMyScoreQueryKey(), v) });
    }, 1200);
    return () => clearTimeout(t);
    // Only the due flag drives this: recording "shown" flips it off for 7 days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);

  if (!snapshot) return null;
  return <PartnerSharingModal visible={visible} onClose={() => setVisible(false)} view={snapshot} mode="reminder" />;
}

const s = StyleSheet.create({
  page: { padding: 24, gap: 12, paddingBottom: 48 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2EAF4", alignSelf: "center", marginBottom: 4 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 21, fontFamily: "Inter_700Bold", lineHeight: 27 },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  bold: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12 },
  benefit: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnOutline: { borderWidth: 1 },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

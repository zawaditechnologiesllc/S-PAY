import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useCreateEnquiry, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

const FAQS = [
  ["How do I receive money?", "Tap Recharge: pick mobile money, bank transfer, or an exchange/wallet and follow the steps. Your QR code and address are under 'Exchange or wallet'."],
  ["How do I cash out?", "Tap Withdraw, choose Mobile money (M-Pesa, MTN MoMo, Airtel, GCash, Nequi) or a bank method, enter the details and confirm."],
  ["Why verify my identity?", "Verification unlocks your US bank account, EU IBAN and local cash-outs."],
];

export default function Support() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const enquiry = useCreateEnquiry();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!message.trim()) { Alert.alert("Help & Support", "Tell us what you need help with."); return; }
    enquiry.mutate(
      { data: { name: me?.fullName, email: me?.email ?? "", subject, message, source: "app" } },
      {
        onSuccess: () => { Alert.alert("Message sent", `We'll reply to ${me?.email} — usually within one business day.`); setSubject(""); setMessage(""); },
        onError: () => Alert.alert("Could not send", "Please try again in a minute."),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Help & Support", headerBackTitle: "Back" }} />
      <ScrollView style={s.page} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.card}>
          <Text style={s.h}>Quick answers</Text>
          {FAQS.map(([q, a]) => (
            <View key={q} style={{ marginBottom: 10 }}>
              <Text style={s.q}>{q}</Text>
              <Text style={s.a}>{a}</Text>
            </View>
          ))}
        </View>
        <View style={[s.card, { marginTop: 14 }]}>
          <Text style={s.h}>Message the team</Text>
          <Text style={s.sub}>Sent from your account ({me?.email}) — we reply by email.</Text>
          <TextInput style={s.input} placeholder="Subject" value={subject} onChangeText={setSubject} maxLength={160} placeholderTextColor="#9ca3af" />
          <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} multiline placeholder="How can we help? *" value={message} onChangeText={setMessage} maxLength={5000} placeholderTextColor="#9ca3af" />
          <TouchableOpacity style={s.btn} onPress={submit} disabled={enquiry.isPending}>
            <Text style={s.btnText}>{enquiry.isPending ? "Sending…" : "Send to support"}</Text>
          </TouchableOpacity>
          <Text style={s.foot}>Prefer email? support@spayewallet.com</Text>
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f9fafb" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  h: { fontWeight: "800", fontSize: 16, color: "#111827", marginBottom: 10 },
  sub: { fontSize: 12, color: "#6b7280", marginBottom: 10 },
  q: { fontWeight: "700", fontSize: 13, color: "#111827", marginBottom: 3 },
  a: { fontSize: 12.5, color: "#4b5563", lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, fontSize: 14, color: "#111827", marginBottom: 10 },
  btn: { backgroundColor: "#4DC9EE", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  foot: { fontSize: 11, color: "#9ca3af", marginTop: 10, textAlign: "center" },
});

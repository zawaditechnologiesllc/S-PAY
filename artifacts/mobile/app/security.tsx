import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey, useSetTransactionPin } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";

export default function Security() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const setPin = useSetTransactionPin();
  const qc = useQueryClient();
  const hasPin = me?.hasPin ?? false;
  const [currentPin, setCurrentPin] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const d = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const submit = () => {
    if (!/^\d{4,6}$/.test(next)) { Alert.alert("PIN", "PIN must be 4–6 digits."); return; }
    if (next !== confirm) { Alert.alert("PIN", "The two PINs don't match."); return; }
    if (hasPin && !/^\d{4,6}$/.test(currentPin)) { Alert.alert("PIN", "Enter your current PIN to change it."); return; }
    setPin.mutate(
      { data: { pin: next, ...(hasPin ? { currentPin } : {}) } },
      {
        onSuccess: (r) => {
          setCurrentPin(""); setNext(""); setConfirm("");
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          Alert.alert(hasPin ? "PIN updated" : "PIN set", (r as { message?: string })?.message ?? "Done.");
        },
        onError: (e: any) => Alert.alert("Could not save", e?.response?.data?.message ?? "Try again."),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Security", headerBackTitle: "Back" }} />
      <ScrollView style={s.page} contentContainerStyle={{ padding: 16 }}>
        <View style={s.card}>
          <View style={s.head}>
            <View style={s.icon}><Feather name="lock" size={20} color="#2E8FD6" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Transaction PIN</Text>
              <Text style={s.sub}>{hasPin ? "Required for every send and withdrawal." : "Set a PIN to start sending money."}</Text>
            </View>
          </View>
          {hasPin && (
            <Text style={s.active}>✓ A PIN is active on your account.</Text>
          )}
          {hasPin && (
            <TextInput style={s.input} placeholder="Current PIN" placeholderTextColor="#9ca3af"
              value={currentPin} onChangeText={(v) => setCurrentPin(d(v))} keyboardType="number-pad" secureTextEntry maxLength={6} />
          )}
          <TextInput style={s.input} placeholder={hasPin ? "New PIN (4–6 digits)" : "Choose a PIN (4–6 digits)"} placeholderTextColor="#9ca3af"
            value={next} onChangeText={(v) => setNext(d(v))} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <TextInput style={s.input} placeholder="Confirm PIN" placeholderTextColor="#9ca3af"
            value={confirm} onChangeText={(v) => setConfirm(d(v))} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <TouchableOpacity style={s.btn} onPress={submit} disabled={setPin.isPending}>
            <Text style={s.btnText}>{setPin.isPending ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}</Text>
          </TouchableOpacity>
          <Text style={s.foot}>Never share your PIN. After 5 wrong attempts it locks for 15 minutes.</Text>
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f9fafb" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#e8f7fc", alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "800", fontSize: 16, color: "#111827" },
  sub: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  active: { fontSize: 12, color: "#15803d", backgroundColor: "#f0fdf4", borderRadius: 8, padding: 8, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 13, fontSize: 16, color: "#111827", marginBottom: 10 },
  btn: { backgroundColor: "#4DC9EE", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  foot: { fontSize: 11, color: "#9ca3af", marginTop: 12, lineHeight: 16 },
});

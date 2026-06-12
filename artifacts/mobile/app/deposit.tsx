import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Share, StyleSheet, ActivityIndicator } from "react-native";
import { router, Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import { useAddFunds, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

/** Deposit (Add money) — MiniPay-style: pick a method, crypto shows your QR. */
export default function Deposit() {
  const [method, setMethod] = useState<null | "momo" | "bank" | "crypto">(null);

  return (
    <>
      <Stack.Screen options={{ title: "Deposit", headerBackTitle: "Back" }} />
      <ScrollView style={s.page} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {method === null && (
          <View style={s.card}>
            <MethodRow icon="smartphone" color="#22C55E" title="Mobile money" subtitle="M-Pesa, MTN MoMo, Airtel, GCash, PIX…" onPress={() => setMethod("momo")} />
            <MethodRow icon="home" color="#2E8FD6" title="Bank transfer" subtitle="Your US account & EU IBAN" onPress={() => setMethod("bank")} />
            <MethodRow icon="repeat" color="#F59E0B" title="Exchange or wallet" subtitle="From Binance, Bybit or any Celo wallet — instant" onPress={() => setMethod("crypto")} />
          </View>
        )}
        {method === "momo" && (
          <View style={s.card}>
            <PanelHeader title="Mobile money" onBack={() => setMethod(null)} />
            {["🇰🇪 M-Pesa", "🇺🇬 MTN Mobile Money", "🇳🇬 Airtel Money", "🇵🇭 GCash", "🇧🇷 PIX"].map((m) => (
              <View key={m} style={s.optionRow}><Text style={s.optionText}>{m}</Text><Feather name="chevron-right" size={16} color="#9ca3af" /></View>
            ))}
            <Text style={s.tip}>Tip: the Exchange or wallet method is instant today — top up Binance with mobile money, then deposit here in seconds.</Text>
          </View>
        )}
        {method === "bank" && (
          <View style={s.card}>
            <PanelHeader title="Bank transfer" onBack={() => setMethod(null)} />
            <Text style={s.body}>Verified members get a real US bank account (ACH) and a European IBAN. Incoming transfers are converted to digital dollars automatically.</Text>
            <TouchableOpacity style={s.cta} onPress={() => router.push("/(tabs)/banking")}>
              <Text style={s.ctaText}>View my account details</Text>
            </TouchableOpacity>
          </View>
        )}
        {method === "crypto" && <CryptoPanel onBack={() => setMethod(null)} />}
      </ScrollView>
    </>
  );
}

const RECEIVE_SOURCES = [
  { id: "binance", name: "Binance", emoji: "🟡", steps: ["Open Binance → Assets → Withdraw", "Choose USDC (or USDT)", "Network: select CELO — the critical step", "Paste your S-PAY address → confirm"] },
  { id: "bybit", name: "Bybit", emoji: "⚫", steps: ["Open Bybit → Assets → Withdraw", "Choose USDC (or USDT)", "Chain type: select CELO", "Paste your S-PAY address → confirm"] },
  { id: "okx", name: "OKX", emoji: "⚪", steps: ["Open OKX → Assets → Withdraw", "Choose USDC (or USDT) → on-chain", "Network: select Celo", "Paste your S-PAY address → confirm"] },
  { id: "wallet", name: "Another Celo wallet", emoji: "👛", steps: ["Open the sender's wallet app", "Choose Send → USDC or USDT", "Paste your S-PAY address (or scan your QR)", "Send — arrives in ~5 seconds"] },
] as const;

function CryptoPanel({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<null | "qr" | string>(null);
  const source = RECEIVE_SOURCES.find((x) => x.id === view);
  const addFunds = useAddFunds();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    addFunds.mutate(
      { data: { amount: 0, currency: "USDC", method: "bank_transfer" } },
      {
        onSuccess: (res) => {
          const addr = (res as { celoAddress?: string })?.celoAddress;
          if (addr) setAddress(addr); else setError("Your wallet is still being prepared — try again in a moment.");
        },
        onError: (e) => setError((e as { data?: { message?: string } })?.data?.message ?? "Your wallet is still being prepared — try again shortly."),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={s.card}>
      <PanelHeader title="Receive from an exchange or wallet" onBack={onBack} />
      {error ? (
        <Text style={s.warn}>{error}</Text>
      ) : !address ? (
        <ActivityIndicator style={{ marginVertical: 40 }} color="#4DC9EE" />
      ) : source ? (
        <>
          {source.steps.map((st, i) => (
            <View key={st} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#4DC9EE", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 }}>{st}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={copy} style={{ backgroundColor: "#f9fafb", borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace" as never }}>{address}</Text>
            <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{copied ? "✓ Copied" : "Tap to copy your address"}</Text>
          </TouchableOpacity>
          <Text style={s.warnSmall}>⚠ The network must be Celo. Funds sent on other networks can be lost.</Text>
          <TouchableOpacity onPress={() => setView(null)} style={{ marginTop: 10 }}>
            <Text style={{ color: "#2E8FD6", fontWeight: "700", fontSize: 13, textAlign: "center" }}>← Other options</Text>
          </TouchableOpacity>
        </>
      ) : view !== "qr" ? (
        <>
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Where is the money coming from? Each option shows the exact steps.</Text>
          {RECEIVE_SOURCES.map((x) => (
            <TouchableOpacity key={x.id} style={s.optionRow} onPress={() => setView(x.id)}>
              <Text style={s.optionText}>{x.emoji}  {x.name}</Text>
              <Feather name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.optionRow} onPress={() => setView("qr")}>
            <Text style={s.optionText}>🔳  My QR code</Text>
            <Feather name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={s.qrWrap}>
            <Text style={s.name}>{me?.fullName ?? "My S-PAY"}</Text>
            <View style={s.qrBox}>
              <QRCode value={address} size={208} color="#1A2B4A" backgroundColor="#ffffff" />
            </View>
            <TouchableOpacity onPress={copy}><Text style={s.addr}>{address}</Text></TouchableOpacity>
            <Text style={s.hint}>Tap the address to copy</Text>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btn} onPress={copy}>
              <Feather name={copied ? "check-circle" : "copy"} size={15} color={copied ? "#22C55E" : "#1A2B4A"} />
              <Text style={s.btnText}>{copied ? "Copied" : "Copy"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => Share.share({ message: `Pay me on S-PAY — send USDC/USDT on the Celo network to: ${address}` })}>
              <Feather name="share-2" size={15} color="#1A2B4A" />
              <Text style={s.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.warnSmall}>⚠ Send USDC or USDT on the Celo network only. Funds appear in seconds.</Text>
          <TouchableOpacity onPress={() => setView(null)} style={{ marginTop: 10 }}>
            <Text style={{ color: "#2E8FD6", fontWeight: "700", fontSize: 13, textAlign: "center" }}>← Other options</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function MethodRow({ icon, color, title, subtitle, onPress }: {
  icon: keyof typeof Feather.glyphMap; color: string; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.methodRow} onPress={onPress}>
      <View style={[s.methodIcon, { backgroundColor: color }]}><Feather name={icon} size={20} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.methodTitle}>{title}</Text>
        <Text style={s.methodSub}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#d1d5db" />
    </TouchableOpacity>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.panelHeader}>
      <TouchableOpacity style={s.backBtn} onPress={onBack}><Feather name="arrow-left" size={16} color="#4b5563" /></TouchableOpacity>
      <Text style={s.panelTitle}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f9fafb" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  methodIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  methodTitle: { fontWeight: "700", fontSize: 15, color: "#111827" },
  methodSub: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  panelTitle: { fontWeight: "700", fontSize: 16, color: "#111827" },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9fafb", borderRadius: 12, padding: 13, marginBottom: 8 },
  optionText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  tip: { fontSize: 12, color: "#1d4ed8", backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, lineHeight: 17, marginTop: 4 },
  body: { fontSize: 13, color: "#4b5563", lineHeight: 19, marginBottom: 12 },
  cta: { backgroundColor: "#4DC9EE", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  qrWrap: { alignItems: "center", backgroundColor: "#fffef0", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#f3f4f6" },
  name: { fontWeight: "700", color: "#111827", marginBottom: 10 },
  qrBox: { backgroundColor: "#fff", padding: 10, borderRadius: 14 },
  addr: { fontSize: 11, color: "#4b5563", textAlign: "center", marginTop: 10, fontFamily: "monospace" as never },
  hint: { fontSize: 10, color: "#9ca3af", marginTop: 3 },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingVertical: 11 },
  btnText: { fontWeight: "700", fontSize: 13, color: "#1A2B4A" },
  warn: { fontSize: 13, color: "#92400e", backgroundColor: "#fffbeb", borderRadius: 12, padding: 14 },
  warnSmall: { fontSize: 11, color: "#92400e", backgroundColor: "#fffbeb", borderRadius: 10, padding: 10, marginTop: 10, lineHeight: 16 },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

// MiniPay-style launch screen, tailored to S-PAY:
// brand panel → three crisp value props → one-tap continue → "Built on Celo" anchor.
const VALUE_PROPS = [
  { emoji: "💸", title: "Get paid globally", desc: "Virtual US account & EU IBAN — receive from any employer or client" },
  { emoji: "⚡", title: "Cash out in minutes", desc: "M-Pesa, MTN MoMo, GCash, PIX, SEPA & 50+ local methods" },
  { emoji: "💼", title: "Find remote work", desc: "3,000–5,000 remote jobs daily, free for every member" },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <LinearGradient colors={["#1A2B4A", "#0d1f38"]} style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: topPad + 36, paddingBottom: bottomPad + 20 }]}>

        {/* Brand */}
        <View style={styles.brand}>
          <Image source={require("../assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>S-PAY</Text>
          <Text style={styles.tagline}>The money app that works where you work.</Text>
        </View>

        {/* Value props */}
        <View style={styles.props}>
          {VALUE_PROPS.map((p) => (
            <View key={p.title} style={styles.propRow}>
              <View style={styles.propIcon}><Text style={{ fontSize: 22 }}>{p.emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.propTitle}>{p.title}</Text>
                <Text style={styles.propDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/register")}
            testID="button-get-started"
          >
            <Text style={styles.primaryText}>Get Started — It's Free</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/login")}
            testID="button-welcome-signin"
          >
            <Text style={styles.secondaryText}>I already have an account</Text>
          </TouchableOpacity>

          {/* Built on Celo — the same declaration MiniPay makes */}
          <View style={styles.celoRow}>
            <View style={styles.celoDot} />
            <Text style={styles.celoText}>Built on Celo</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 26, justifyContent: "space-between" },
  brand: { alignItems: "center", gap: 12 },
  logo: { width: 88, height: 88, borderRadius: 22 },
  appName: { color: "#fff", fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tagline: { color: "#A8DEFF", fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  props: { gap: 18 },
  propRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  propIcon: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(77,201,238,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(77,201,238,0.3)",
  },
  propTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  propDesc: { color: "rgba(168,222,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ctas: { gap: 12 },
  primaryBtn: {
    backgroundColor: "#4DC9EE", borderRadius: 16, paddingVertical: 17, alignItems: "center",
    shadowColor: "#4DC9EE", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  primaryText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  secondaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  celoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 8 },
  celoDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FCFF52" },
  celoText: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
});

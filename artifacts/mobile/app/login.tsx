import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const login = useLogin();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter email and password");
      return;
    }
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: async (data: any) => {
          await signIn(data.token);
          router.replace("/(tabs)");
        },
        onError: (e: any) => {
          Alert.alert("Login failed", e?.response?.data?.message ?? "Invalid credentials");
        },
      }
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.logoCard}
      >
        <View style={styles.logoInner}>
          <Text style={styles.logoS}>S</Text>
        </View>
        <Text style={styles.logoName}>S-PAY</Text>
        <Text style={styles.logoTagline}>Your global digital wallet</Text>
      </LinearGradient>

      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to your account</Text>

        <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="input-email"
          />
        </View>

        <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput
              style={[styles.input, { flex: 1, color: colors.foreground }]}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              testID="input-password"
            />
            <TouchableOpacity onPress={() => setShowPw((p) => !p)} style={{ padding: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                {showPw ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.demoBanner, { backgroundColor: colors.muted }]}>
          <Text style={[styles.demoText, { color: colors.mutedForeground }]}>
            Demo: demo@spayewallet.com / demo1234
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={login.isPending}
          testID="button-login"
        >
          {login.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push("/register")} style={styles.linkRow} testID="link-register">
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
        <Text style={[styles.link, { color: colors.primary }]}>Create one</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 20, gap: 20 },
  logoCard: { width: "100%", borderRadius: 24, alignItems: "center", padding: 32, gap: 10 },
  logoInner: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  logoS: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#4DC9EE" },
  logoName: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  logoTagline: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular" },
  formCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -8 },
  inputGroup: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 16, fontFamily: "Inter_400Regular", padding: 0 },
  pwRow: { flexDirection: "row", alignItems: "center" },
  demoBanner: { borderRadius: 10, padding: 10, alignItems: "center" },
  demoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  linkRow: { flexDirection: "row", alignItems: "center" },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

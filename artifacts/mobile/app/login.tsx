import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLogin, useVerifyLoginCode } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Two-step email MFA: enter password → enter the 6-digit code we email.
  const [step, setStep] = useState<"password" | "verify">("password");
  const [code, setCode] = useState("");
  const login = useLogin();
  const verifyCode = useVerifyLoginCode();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const networkAlert = (e: any, fallbackTitle: string) => {
    const isNetwork = !e?.status && /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(e?.message ?? "");
    Alert.alert(
      isNetwork ? "Can't reach the server" : fallbackTitle,
      isNetwork
        ? "Check your internet connection and try again. If the app was idle, the server may be waking up — wait a few seconds and retry."
        : (e?.response?.data?.message ?? e?.data?.message ?? "Something went wrong. Please try again."),
    );
  };

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter email and password");
      return;
    }
    login.mutate(
      { data: { email, password } },
      {
        // Password accepted → a 6-digit code is emailed; move to the code step.
        onSuccess: () => { setStep("verify"); setCode(""); },
        onError: (e: any) => networkAlert(e, "Login failed"),
      }
    );
  };

  const handleVerify = () => {
    if (!/^\d{6}$/.test(code)) {
      Alert.alert("Enter the 6-digit code", "Check the email we just sent you.");
      return;
    }
    verifyCode.mutate(
      { data: { email, code } },
      {
        onSuccess: async (data: any) => {
          await signIn(data.token);
          router.replace("/(tabs)");
        },
        onError: (e: any) => networkAlert(e, "That code didn't work"),
      }
    );
  };

  const resendCode = () => {
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: () => Alert.alert("New code sent", `Check ${email} again.`),
        onError: (e: any) => networkAlert(e, "Couldn't resend the code"),
      }
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
        style={styles.backRow}
        testID="button-back"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
      </TouchableOpacity>

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.logoCard}
      >
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoName}>S-PAY</Text>
        <Text style={styles.logoTagline}>Receive globally. Cash out locally.</Text>
      </LinearGradient>

      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {step === "verify" ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Enter your code</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              We emailed a 6-digit code to {email}. It expires in 10 minutes.
            </Text>

            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>6-digit code</Text>
              <TextInput
                style={[styles.input, styles.codeInput, { color: colors.foreground }]}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                testID="input-code"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={handleVerify}
              disabled={verifyCode.isPending}
              testID="button-verify"
            >
              {verifyCode.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Verify & sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.verifyActions}>
              <TouchableOpacity onPress={() => { setStep("password"); setCode(""); }}>
                <Text style={[styles.link, { color: colors.mutedForeground }]}>Back to sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resendCode} disabled={login.isPending}>
                <Text style={[styles.link, { color: colors.primary }]}>
                  {login.isPending ? "Sending…" : "Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to your account</Text>

            {/* Platform-native sign-in: Google on Android, Apple on iOS */}
            <SocialAuthButtons signupSource="mobile" />

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
          </>
        )}
      </View>

      <TouchableOpacity onPress={() => router.push("/register")} style={styles.linkRow} testID="link-register">
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
        <Text style={[styles.link, { color: colors.primary }]}>Create one</Text>
      </TouchableOpacity>

      <View style={styles.celoRow}>
        <View style={styles.celoDot} />
        <Text style={[styles.celoText, { color: colors.mutedForeground }]}>Built on Celo</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 20, gap: 20 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  logoCard: { width: "100%", borderRadius: 24, alignItems: "center", padding: 32, gap: 10 },
  logoImage: { width: 72, height: 72, borderRadius: 18 },
  logoName: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  logoTagline: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular" },
  formCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -8 },
  inputGroup: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 16, fontFamily: "Inter_400Regular", padding: 0 },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: "center", fontFamily: "Inter_700Bold" },
  verifyActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pwRow: { flexDirection: "row", alignItems: "center" },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  linkRow: { flexDirection: "row", alignItems: "center" },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  celoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6 },
  celoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FCFF52", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  celoText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
});

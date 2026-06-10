import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const register = useRegister();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleRegister = () => {
    if (!fullName || !email || !password) {
      Alert.alert("Missing fields", "Full name, email, and password are required");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters");
      return;
    }
    register.mutate(
      { data: { fullName, email, password, phoneNumber: phone || undefined, signupSource: "mobile" } },
      {
        onSuccess: async (data: any) => {
          await signIn(data.token);
          router.replace("/(tabs)");
        },
        onError: (e: any) => {
          Alert.alert("Registration failed", e?.response?.data?.message ?? "Please try again");
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
        style={styles.hero}
      >
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.heroTitle}>Create Account</Text>
        <Text style={styles.heroSub}>Receive globally. Cash out locally.</Text>
      </LinearGradient>

      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: "Full Name", value: fullName, onChange: setFullName, placeholder: "Alex Johnson", keyboard: "default" as const, icon: "user" as const },
          { label: "Email Address", value: email, onChange: setEmail, placeholder: "you@example.com", keyboard: "email-address" as const, icon: "mail" as const },
          { label: "Phone (optional)", value: phone, onChange: setPhone, placeholder: "+1 555 000 0000", keyboard: "phone-pad" as const, icon: "phone" as const },
          { label: "Password", value: password, onChange: setPassword, placeholder: "At least 8 characters", keyboard: "default" as const, icon: "lock" as const, secure: true },
        ].map((field) => (
          <View key={field.label} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{field.label}</Text>
            <View style={styles.inputRow}>
              <Feather name={field.icon} size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder={field.placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType={field.keyboard}
                secureTextEntry={field.secure}
                autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                testID={`input-${field.label.toLowerCase().replace(/\s+/g, "-")}`}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleRegister}
          disabled={register.isPending}
          testID="button-register"
        >
          {register.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push("/login")} style={styles.linkRow} testID="link-login">
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Already have an account? </Text>
        <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 20, gap: 20 },
  hero: { width: "100%", borderRadius: 24, alignItems: "center", padding: 28, gap: 8 },
  logoImage: { width: 56, height: 56, borderRadius: 16 },
  logoInner: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  logoS: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#4DC9EE" },
  heroTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  formCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  inputGroup: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  linkRow: { flexDirection: "row", alignItems: "center" },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

import React, { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, View, Alert, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useGoogleTokenSignIn, useAppleTokenSignIn } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

// Native sign-in follows each platform's convention (like MiniPay):
//   Android → Continue with Google  ·  iOS → Sign in with Apple
// Email/password is always available on both.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

const googleConfigured = Boolean(GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID);

function GoogleButton({ signupSource }: { signupSource: string }) {
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useAuth();
  const googleSignIn = useGoogleTokenSignIn();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = (response.params as Record<string, string>)?.id_token;
    if (!idToken) return;
    googleSignIn.mutate(
      { data: { idToken, signupSource } },
      {
        onSuccess: async (data: any) => {
          await signIn(data.token);
          router.replace("/(tabs)");
        },
        onError: (e: any) => {
          Alert.alert("Google sign-in failed", e?.response?.data?.message ?? "Please try again");
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <TouchableOpacity
      style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
      disabled={!request || googleSignIn.isPending}
      onPress={() => promptAsync()}
      testID="button-google-signin"
    >
      <Text style={styles.googleG}>G</Text>
      <Text style={[styles.socialText, { color: colors.foreground }]}>
        {googleSignIn.isPending ? "Signing in…" : "Continue with Google"}
      </Text>
    </TouchableOpacity>
  );
}

function AppleButton({ signupSource }: { signupSource: string }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const appleSignIn = useAppleTokenSignIn();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return;
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean).join(" ") || undefined;
      appleSignIn.mutate(
        { data: { identityToken: credential.identityToken, fullName, signupSource } },
        {
          onSuccess: async (data: any) => {
            await signIn(data.token);
            router.replace("/(tabs)");
          },
          onError: (e: any) => {
            Alert.alert("Apple sign-in failed", e?.response?.data?.message ?? "Please try again");
          },
        },
      );
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple sign-in failed", "Please try again");
      }
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={14}
      style={styles.appleBtn}
      onPress={handlePress}
    />
  );
}

export function SocialAuthButtons({ signupSource }: { signupSource: string }) {
  const colors = useColors();
  const showGoogle = Platform.OS === "android" && googleConfigured;
  const showApple = Platform.OS === "ios";

  if (!showGoogle && !showApple) return null;

  return (
    <View style={styles.wrap}>
      {showApple && <AppleButton signupSource={signupSource} />}
      {showGoogle && <GoogleButton signupSource={signupSource} />}
      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or use email</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 12 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderWidth: 1, borderRadius: 14, paddingVertical: 14,
  },
  googleG: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#4285F4" },
  socialText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  appleBtn: { width: "100%", height: 50 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

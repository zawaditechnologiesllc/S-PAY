import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useGetMe, getGetMeQueryKey, useDeleteAccount } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const kycStatusColor = (s: string) => s === "approved" ? "#22C55E" : s === "rejected" ? "#EF4444" : "#F59E0B";
const kycStatusIcon = (s: string) => s === "approved" ? "check-circle" : s === "rejected" ? "x-circle" : "clock";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  const deleteAccount = useDeleteAccount();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive", onPress: async () => {
          await signOut();
          router.replace("/welcome");
        },
      },
    ]);
  };

  // In-app account deletion — required by App Store 5.1.1(v) and the
  // Google Play account-deletion policy for any app with account creation.
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account, wallet link, and transaction history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever", style: "destructive", onPress: () => {
            deleteAccount.mutate(undefined as never, {
              onSuccess: async () => {
                await signOut();
                router.replace("/welcome");
              },
              onError: (e: any) => {
                Alert.alert("Deletion failed", e?.response?.data?.message ?? "Please try again or contact support@spayewallet.com");
              },
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="button-back">
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarText}>{user?.fullName?.[0] ?? "?"}</Text>
            </View>
            <Text style={styles.nameText}>{user?.fullName}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            {user?.kycStatus && (
              <View style={[styles.kycBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name={kycStatusIcon(user.kycStatus) as any} size={13} color="#fff" />
                <Text style={styles.kycText}>KYC {user.kycStatus.charAt(0).toUpperCase() + user.kycStatus.slice(1)}</Text>
              </View>
            )}
          </>
        )}
      </LinearGradient>

      {user && (
        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
          {/* Info Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Account Details</Text>
            {[
              { icon: "user" as const, label: "Full Name", value: user.fullName },
              { icon: "mail" as const, label: "Email", value: user.email },
              { icon: "phone" as const, label: "Phone", value: user.phoneNumber ?? "Not set" },
            ].map((item) => (
              <View key={item.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.infoIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={15} color={colors.primary} />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Celo Wallet */}
          {user.celoWalletAddress && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Web3 Identity</Text>
              <View style={[styles.infoRow, { borderBottomColor: "transparent" }]}>
                <View style={[styles.infoIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Feather name="link" size={15} color="#22C55E" />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Celo Wallet</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground, fontSize: 12 }]} numberOfLines={1}>
                    {user.celoWalletAddress}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Legal */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>About & Legal</Text>
            {[
              { icon: "shield" as const, label: "Privacy Policy", url: "https://spayewallet.com/privacy" },
              { icon: "file-text" as const, label: "Terms of Service", url: "https://spayewallet.com/terms" },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={[styles.infoRow, { borderBottomColor: colors.border }]} onPress={() => Linking.openURL(item.url)}>
                <View style={[styles.infoIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={15} color={colors.primary} />
                </View>
                <Text style={[styles.infoValue, { color: colors.foreground, flex: 1 }]}>{item.label}</Text>
                <Feather name="external-link" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
            <View style={[styles.infoRow, { borderBottomColor: "transparent" }]}>
              <View style={styles.celoDot} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Built on Celo · © Zawadi Technologies LLC</Text>
            </View>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: "#EF4444" }]}
            onPress={handleSignOut}
            testID="button-sign-out"
          >
            <Feather name="log-out" size={18} color="#EF4444" />
            <Text style={[styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            disabled={deleteAccount.isPending}
            testID="button-delete-account"
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.deleteText}>Delete my account permanently</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 28, alignItems: "center", gap: 8 },
  backBtn: { alignSelf: "flex-start", marginBottom: 12 },
  avatarLg: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold" },
  nameText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  emailText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular" },
  kycBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  kycText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", gap: 0 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 16, paddingBottom: 0 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1 },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14 },
  signOutText: { color: "#EF4444", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { alignItems: "center", paddingVertical: 12 },
  deleteText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
  celoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FCFF52", marginLeft: 13, marginRight: -2 },
});

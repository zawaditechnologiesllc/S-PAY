import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetJobById, getGetJobByIdQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const sourceColors: Record<string, string> = {
  Himalayas: "#4DC9EE",
  RemoteOK: "#22C55E",
  Remotive: "#8B5CF6",
};

export default function JobDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: job, isLoading, error } = useGetJobById(id ?? "", {
    query: { queryKey: getGetJobByIdQueryKey(id ?? ""), enabled: !!id },
  });

  const apply = () => {
    if (job?.applyUrl) WebBrowser.openBrowserAsync(job.applyUrl);
  };

  const sourceColor = sourceColors[job?.source ?? ""] ?? "#64748B";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerBar, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} testID="button-back">
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Job Details</Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 64 }} />
        ) : error ? (
          <View style={styles.errorState}>
            <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>Job not found</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.backLink, { color: colors.primary }]}>Go back to Jobs</Text>
            </TouchableOpacity>
          </View>
        ) : job ? (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Job Header */}
            <View style={[styles.jobHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.companyAvatar, { backgroundColor: `${sourceColor}15` }]}>
                <Text style={[styles.companyInitial, { color: sourceColor }]}>
                  {job.company?.[0] ?? "?"}
                </Text>
              </View>
              <Text style={[styles.jobTitle, { color: colors.foreground }]}>{job.title}</Text>
              <Text style={[styles.company, { color: colors.mutedForeground }]}>{job.company}</Text>
              <View style={[styles.sourceBadge, { backgroundColor: `${sourceColor}15` }]}>
                <Text style={[styles.sourceText, { color: sourceColor }]}>via {job.source}</Text>
              </View>
              {job.isNew && (
                <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.newText}>New</Text>
                </View>
              )}
            </View>

            {/* Details */}
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { icon: "dollar-sign" as const, label: "Salary", value: job.salary },
                { icon: "globe" as const, label: "Location", value: job.location },
                { icon: "briefcase" as const, label: "Job Type", value: job.jobType?.replace("_", " ") },
                { icon: "tag" as const, label: "Category", value: job.category },
              ].map((item) => (
                <View key={item.label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.muted }]}>
                    <Feather name={item.icon} size={15} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Description */}
            {job.description ? (
              <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.descTitle, { color: colors.foreground }]}>About this role</Text>
                <Text style={[styles.descText, { color: colors.mutedForeground }]}>
                  {job.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                </Text>
              </View>
            ) : null}

            {/* Affiliate CTA */}
            {job.affiliateCta && (
              <TouchableOpacity
                style={[styles.affiliateBanner, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                onPress={() => WebBrowser.openBrowserAsync(job.affiliateCta!.url)}
              >
                <Feather name="globe" size={16} color="#3B82F6" />
                <Text style={[styles.affiliateText, { color: "#1E40AF" }]}>{job.affiliateCta.label}</Text>
                <Feather name="arrow-right" size={16} color="#3B82F6" />
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Apply Button */}
      {job && (
        <View style={[styles.applyBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            onPress={apply}
            testID="button-apply"
          >
            <Feather name="external-link" size={18} color="#fff" />
            <Text style={styles.applyText}>Apply Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  errorState: { alignItems: "center", padding: 48, gap: 12 },
  errorText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  backLink: { fontSize: 15, fontFamily: "Inter_500Medium" },
  jobHeader: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  companyAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  companyInitial: { fontSize: 26, fontFamily: "Inter_700Bold" },
  jobTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  company: { fontSize: 15, fontFamily: "Inter_400Regular" },
  sourceBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  sourceText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  newBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  newText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailsCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1 },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  descCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  descTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  affiliateBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  affiliateText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  applyBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 12, borderTopWidth: 1 },
  applyBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  applyText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

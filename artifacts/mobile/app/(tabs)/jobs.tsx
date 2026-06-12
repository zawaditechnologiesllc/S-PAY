import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TextInput,
  ActivityIndicator, TouchableOpacity, Platform, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  useGetJobs, getGetJobsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { JobCard } from "@/components/JobCard";

const CATEGORIES = ["All", "Engineering", "Design", "Marketing", "Sales", "Finance", "Operations"];

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, refetch } = useGetJobs(
    { keyword: debouncedSearch || undefined, category: category !== "All" ? category : undefined, limit: 30 },
    { query: { queryKey: getGetJobsQueryKey({ keyword: debouncedSearch || undefined, category: category !== "All" ? category : undefined, limit: 30 }) } }
  );

  const handleSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => setDebouncedSearch(text), 400);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.headerGrad, { paddingTop: topPad + 16 }]}
      >
        <Text style={styles.headerSub}>Remote Opportunities</Text>
        <Text style={styles.headerTitle}>Find Jobs</Text>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: "#fff" }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search jobs, companies..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            testID="input-job-search"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(""); setDebouncedSearch(""); }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.catChip,
              {
                backgroundColor: category === item ? colors.primary : colors.card,
                borderColor: category === item ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setCategory(item)}
            testID={`button-category-${item}`}
          >
            <Text style={[styles.catText, { color: category === item ? "#fff" : colors.mutedForeground }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Affiliate Banner */}
      {data?.remoteCom && (
        <TouchableOpacity
          style={[styles.affiliateBanner, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
          onPress={() => WebBrowser.openBrowserAsync(data?.remoteCom?.url ?? "")}
        >
          <Feather name="globe" size={14} color="#3B82F6" />
          <Text style={[styles.affiliateText, { color: "#1E40AF" }]} numberOfLines={1}>{data.remoteCom.label}</Text>
          <Feather name="arrow-right" size={14} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {/* Jobs List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={data?.jobs ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JobCard
              {...item}
              onPress={() => router.push({ pathname: "/job/[id]", params: { id: item.id } })}
            />
          )}
          contentContainerStyle={{ paddingBottom: bottomPad + 80, paddingTop: 4 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="briefcase" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs found</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "Try a different category"}
              </Text>
            </View>
          }
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { paddingHorizontal: 16, paddingBottom: 20 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  catList: { flexGrow: 0 },
  catChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  catText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  affiliateBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 4, borderRadius: 10, borderWidth: 1, padding: 10 },
  affiliateText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", padding: 48, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});

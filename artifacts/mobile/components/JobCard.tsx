import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface JobCardProps {
  id: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  jobType: string;
  source: string;
  isNew: boolean;
  onPress: () => void;
}

const sourceColors: Record<string, string> = {
  Himalayas: "#4DC9EE",
  RemoteOK: "#22C55E",
  Remotive: "#8B5CF6",
};

export function JobCard({ id, title, company, salary, location, jobType, source, isNew, onPress }: JobCardProps) {
  const colors = useColors();
  const sourceColor = sourceColors[source] ?? "#64748B";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      testID={`card-job-${id}`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{title}</Text>
          {isNew && <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.newText}>New</Text>
          </View>}
        </View>
        <Text style={[styles.company, { color: colors.mutedForeground }]}>{company}</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.tag}>
          <Feather name="dollar-sign" size={12} color={colors.mutedForeground} />
          <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{salary}</Text>
        </View>
        <View style={styles.tag}>
          <Feather name="globe" size={12} color={colors.mutedForeground} />
          <Text style={[styles.tagText, { color: colors.mutedForeground }]} numberOfLines={1}>{location}</Text>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: `${sourceColor}15` }]}>
          <Text style={[styles.sourceText, { color: sourceColor }]}>via {source}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
  },
  company: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    maxWidth: 100,
  },
  sourceBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: "auto",
  },
  sourceText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  newBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { SCORE_BANDS, SCORE_MAX, SCORE_MIN, bandFor } from "@workspace/score-model";
import { useColors } from "@/hooks/useColors";

// 180° meter from 300 to 850 — same geometry as the web gauge. Track is a light
// step of the score ramp; the fill takes the band step; text stays in ink.
const W = 240;
const H = 136;
const CX = 120;
const CY = 120;
const R = 100;
const STROKE = 14;
const TRACK = "#E3EDF9";

const toAngle = (score: number) => Math.PI * (1 - (Math.min(SCORE_MAX, Math.max(SCORE_MIN, score)) - SCORE_MIN) / (SCORE_MAX - SCORE_MIN));
const point = (a: number, r = R) => ({ x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) });
const arc = (from: number, to: number) => {
  const a = point(toAngle(from));
  const b = point(toAngle(to));
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
};

export function ScoreGauge({ score, width = 220 }: { score: number | null; width?: number }) {
  const colors = useColors();
  const band = score !== null ? bandFor(score) : null;
  const scale = width / W;
  const tip = score !== null ? point(toAngle(score)) : null;
  return (
    <View style={{ width, alignSelf: "center" }} accessible accessibilityLabel={band && score !== null ? `S-PAY Score ${score}, ${band.label}` : "S-PAY Score unavailable"}>
      <Svg width={width} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
        <Path d={arc(SCORE_MIN, SCORE_MAX)} stroke={TRACK} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        {band && score !== null && score > SCORE_MIN && (
          <Path d={arc(SCORE_MIN, score)} stroke={band.color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        )}
        {SCORE_BANDS.slice(1).map((b) => {
          const a = toAngle(b.min);
          const i = point(a, R - STROKE / 2 - 1);
          const o = point(a, R + STROKE / 2 + 1);
          return <Line key={b.key} x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke={colors.card} strokeWidth={2} />;
        })}
        {band && tip && <Circle cx={tip.x} cy={tip.y} r={STROKE / 2 + 1} fill={band.color} stroke={colors.card} strokeWidth={2} />}
      </Svg>
      <View style={[styles.center, { height: H * scale }]}>
        <Text style={[styles.score, { color: colors.foreground, fontSize: 44 * scale }]}>{score ?? "—"}</Text>
        {band && (
          <View style={styles.bandRow}>
            <View style={[styles.dot, { backgroundColor: band.color }]} />
            <Text style={[styles.band, { color: colors.foreground }]}>{band.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.ends}>
        <Text style={[styles.end, { color: colors.mutedForeground }]}>{SCORE_MIN}</Text>
        <Text style={[styles.end, { color: colors.mutedForeground }]}>{SCORE_MAX}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "flex-end" },
  score: { fontFamily: "Inter_700Bold", letterSpacing: -1 },
  bandRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  band: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ends: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 2 },
  end: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

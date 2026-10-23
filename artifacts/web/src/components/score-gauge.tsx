import { SCORE_BANDS, SCORE_MAX, SCORE_MIN, bandFor } from "@workspace/score-model";

/**
 * S-PAY Score meter: a 180° arc from 300 to 850. The unfilled track is a light
 * step of the score ramp; the fill takes the member's band step; hairline
 * surface-colored gaps mark the band thresholds (550 / 650 / 750). The number
 * is the hero figure and stays in ink — color never carries text.
 */

const VIEW_W = 240;
const VIEW_H = 136;
const CX = 120;
const CY = 120;
const R = 100;
const STROKE = 14;

const toAngle = (score: number) => Math.PI * (1 - (Math.min(SCORE_MAX, Math.max(SCORE_MIN, score)) - SCORE_MIN) / (SCORE_MAX - SCORE_MIN));
const point = (angle: number, r = R) => ({ x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle) });

function arc(from: number, to: number): string {
  const a = point(toAngle(from));
  const b = point(toAngle(to));
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function bandVar(key: string): string {
  return `var(--score-band-${key})`;
}

export function ScoreGauge({
  score,
  size = "lg",
  caption,
  className = "",
}: {
  score: number | null;
  size?: "sm" | "lg";
  caption?: string;
  className?: string;
}) {
  const band = score !== null ? bandFor(score) : null;
  const width = size === "lg" ? 260 : 168;
  const thresholds = SCORE_BANDS.slice(1).map((b) => b.min);

  return (
    <figure
      className={`relative mx-auto ${className}`}
      style={{ width, maxWidth: "100%" }}
      role="img"
      aria-label={score !== null && band ? `S-PAY Score ${score} out of ${SCORE_MAX}, ${band.label}` : "S-PAY Score not available"}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block" aria-hidden="true">
          <path d={arc(SCORE_MIN, SCORE_MAX)} fill="none" stroke="var(--score-track)" strokeWidth={STROKE} strokeLinecap="round" />
          {score !== null && band && score > SCORE_MIN && (
            <path d={arc(SCORE_MIN, score)} fill="none" stroke={bandVar(band.key)} strokeWidth={STROKE} strokeLinecap="round" />
          )}
          {/* threshold gaps in the surface color */}
          {thresholds.map((t) => {
            const a = toAngle(t);
            const inner = point(a, R - STROKE / 2 - 1);
            const outer = point(a, R + STROKE / 2 + 1);
            return <line key={t} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--score-surface)" strokeWidth={2} />;
          })}
          {score !== null && band && (() => {
            const p = point(toAngle(score));
            return <circle cx={p.x} cy={p.y} r={STROKE / 2 + 1} fill={bandVar(band.key)} stroke="var(--score-surface)" strokeWidth={2} />;
          })()}
        </svg>
        <figcaption className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
          <span className={`${size === "lg" ? "text-5xl" : "text-2xl"} font-bold tracking-tight text-gray-900 dark:text-gray-50`}>
            {score ?? "—"}
          </span>
          {band && (
            <span className={`mt-1.5 inline-flex items-center gap-1.5 ${size === "lg" ? "text-sm" : "text-xs"} font-semibold text-gray-700 dark:text-gray-200`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bandVar(band.key) }} />
              {band.label}
            </span>
          )}
          {caption && <span className="mt-1 text-[11px] text-gray-400">{caption}</span>}
        </figcaption>
      </div>
      <div className="flex justify-between text-[10px] font-medium text-gray-400 px-1 mt-1" aria-hidden="true">
        <span>{SCORE_MIN}</span>
        <span>{SCORE_MAX}</span>
      </div>
    </figure>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { SCORE_BANDS, SCORE_MAX, SCORE_MIN } from "@workspace/score-model";
import { bandVar } from "@/components/score-gauge";

export interface ScoreHistoryPoint {
  period: string;   // YYYY-MM
  score: number;
  bandLabel: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatPeriod(period: string, long = false): string {
  const [y, m] = period.split("-").map(Number);
  const name = MONTHS[(m || 1) - 1] ?? period;
  return long ? `${name} ${y}` : name;
}

const H = 200;
const PAD = { top: 20, right: 56, bottom: 26, left: 40 };

/**
 * Monthly score history — one series, so no legend box (the card title names
 * it). 2px line, end dot with a surface ring, endpoint labelled, hairline grid
 * and band thresholds, crosshair + tooltip on hover AND keyboard (←/→), and a
 * table view so no value is hover-gated.
 */
export function ScoreHistoryChart({ points }: { points: ScoreHistoryPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Draw at the container's real pixel width so text stays 11px at any size
  // (a scaled viewBox would blow labels up on wide screens).
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { yMin, yMax, ticks } = useMemo(() => {
    const scores = points.map((p) => p.score);
    const lo = Math.max(SCORE_MIN, Math.floor((Math.min(...scores) - 40) / 50) * 50);
    const hi = Math.min(SCORE_MAX, Math.ceil((Math.max(...scores) + 40) / 50) * 50);
    const step = hi - lo > 300 ? 100 : 50;
    const t: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) t.push(v);
    return { yMin: lo, yMax: hi, ticks: t };
  }, [points]);

  if (points.length === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const thresholds = SCORE_BANDS.slice(1).filter((b) => b.min > yMin && b.min < yMax);

  const nearest = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i;
    return best;
  };

  const tip = active !== null ? points[active] : null;
  const tipLeftPct = active !== null ? (x(active) / W) * 100 : 0;

  return (
    <div>
      <div className="relative" ref={boxRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#4DC9EE] rounded-lg"
          role="img"
          aria-label={`S-PAY Score history: ${points.map((p) => `${formatPeriod(p.period, true)} ${p.score}`).join(", ")}`}
          tabIndex={0}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(last)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); setActive((a) => Math.max(0, (a ?? last) - 1)); }
            if (e.key === "ArrowRight") { e.preventDefault(); setActive((a) => Math.min(last, (a ?? last) + 1)); }
          }}
        >
          {/* hairline grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--score-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-gray-400 text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>{t}</text>
            </g>
          ))}
          {/* band thresholds: hairline + label on the right edge */}
          {thresholds.map((b) => (
            <g key={b.key}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(b.min)} y2={y(b.min)} stroke={bandVar(b.key)} strokeOpacity={0.45} strokeWidth={1} />
              <text x={W - PAD.right + 6} y={y(b.min) + 4} className="fill-gray-400 text-[10px]">{b.label} {b.min}</text>
            </g>
          ))}
          {/* x labels */}
          {points.map((p, i) => (
            (points.length <= 6 || i % 2 === last % 2) && (
              <text key={p.period} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[11px]">{formatPeriod(p.period)}</text>
            )
          ))}
          {/* crosshair */}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--score-grid)" strokeWidth={1} />
          )}
          {points.length > 1 && (
            <path d={path} fill="none" stroke="var(--score-mark)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {/* end dot (+ active dot) with a surface ring */}
          {[last, ...(active !== null && active !== last ? [active] : [])].map((i) => (
            <circle key={i} cx={x(i)} cy={y(points[i].score)} r={5} fill="var(--score-mark)" stroke="var(--score-surface)" strokeWidth={2} />
          ))}
          {/* endpoint label only — the tooltip and table carry the rest */}
          <text x={x(last)} y={y(points[last].score) - 12} textAnchor="middle" className="fill-gray-700 dark:fill-gray-200 text-[12px] font-semibold">
            {points[last].score}
          </text>
        </svg>
        {tip && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-md px-3 py-2 text-xs whitespace-nowrap"
            style={{ left: `${Math.min(88, Math.max(12, tipLeftPct))}%` }}
          >
            <div className="text-base font-bold text-gray-900 dark:text-gray-50 leading-tight">{tip.score}</div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: "var(--score-mark)" }} />
              {formatPeriod(tip.period, true)} · {tip.bandLabel}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => setShowTable((s) => !s)}
        className="mt-2 text-xs font-medium text-[#2E8FD6] hover:underline"
        aria-expanded={showTable}
      >
        {showTable ? "Hide table" : "View as table"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="font-medium py-1">Month</th>
              <th className="font-medium py-1 text-right">Score</th>
              <th className="font-medium py-1 text-right">Band</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.period} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5 text-gray-700 dark:text-gray-300">{formatPeriod(p.period, true)}</td>
                <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-gray-100" style={{ fontVariantNumeric: "tabular-nums" }}>{p.score}</td>
                <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{p.bandLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

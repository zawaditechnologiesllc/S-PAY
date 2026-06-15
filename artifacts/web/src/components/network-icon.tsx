import { Wallet2, QrCode, Globe } from "lucide-react";

/**
 * Recognizable badges for crypto networks/exchanges. lucide has no brand
 * logos, so we render each brand's initial on its real brand colour — clean,
 * dependency-free, and unmistakable (vs. ambiguous coloured-circle emoji).
 */
const BRANDS: Record<string, { bg: string; fg: string; text: string }> = {
  binance: { bg: "#F3BA2F", fg: "#181A20", text: "B" },
  bybit:   { bg: "#16181C", fg: "#FFB11A", text: "B" },
  okx:     { bg: "#000000", fg: "#FFFFFF", text: "OK" },
  coinbase:{ bg: "#0052FF", fg: "#FFFFFF", text: "C" },
};

export function NetworkIcon({ brand, size = 40 }: { brand: string; size?: number }) {
  const radius = Math.round(size * 0.28);
  const box = { width: size, height: size, borderRadius: radius } as const;

  if (brand === "wallet") {
    return (
      <div style={{ ...box, background: "#FCFF52" }} className="flex items-center justify-center flex-shrink-0">
        <Wallet2 size={size * 0.5} className="text-[#1A2B4A]" />
      </div>
    );
  }
  if (brand === "qr") {
    return (
      <div style={{ ...box, background: "#1A2B4A" }} className="flex items-center justify-center flex-shrink-0">
        <QrCode size={size * 0.5} className="text-white" />
      </div>
    );
  }
  if (brand === "other") {
    return (
      <div style={{ ...box, background: "#E5E7EB" }} className="flex items-center justify-center flex-shrink-0">
        <Globe size={size * 0.5} className="text-[#4B5563]" />
      </div>
    );
  }
  const b = BRANDS[brand] ?? { bg: "#6B7280", fg: "#FFFFFF", text: "?" };
  return (
    <div
      style={{ ...box, background: b.bg, color: b.fg, fontSize: size * 0.36 }}
      className="flex items-center justify-center font-black flex-shrink-0 leading-none"
      aria-hidden
    >
      {b.text}
    </div>
  );
}

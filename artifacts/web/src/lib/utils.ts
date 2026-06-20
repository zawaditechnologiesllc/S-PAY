import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/**
 * Picks a readable foreground (dark navy or white) for a given hex background,
 * chosen by WCAG contrast ratio. Prevents low-contrast white-on-bright-color
 * text — e.g. white on #4DC9EE, #22C55E, or #F59E0B all fail AA.
 */
export function textOn(hexBg: string, dark = "#0d1f38", light = "#ffffff"): string {
  const bg = relativeLuminance(hexBg)
  const ratio = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return ratio(bg, relativeLuminance(dark)) >= ratio(bg, relativeLuminance(light))
    ? dark
    : light
}

/**
 * Parse salary strings into structured schema.org BaseSalary format.
 * Handles: "$50k–$70k", "$30/hour", "€45,000 per year", "Competitive", etc.
 * Returns null for non-numeric or unparseable formats.
 */
export interface BaseSalary {
  currency: string;
  value?: {
    minValue?: number;
    maxValue?: number;
    unitText: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
  };
}

export function parseBaseSalary(salary: string | null | undefined): BaseSalary | null {
  if (!salary || typeof salary !== "string" || salary.length === 0) return null;

  const trimmed = salary.trim().toLowerCase();

  // Reject non-numeric qualifiers
  if (/^(competitive|doe|n\/a|tbd|negotiable|flexible)$/i.test(trimmed)) {
    return null;
  }

  // Try to find currency and numbers
  const currencyMatch = trimmed.match(/(\$|€|£|¥)/);
  const currency = currencyMatch ? currencyMatch[1] : "$";

  // Extract all numbers (with optional decimal)
  const numbers = trimmed.match(/\d+(?:,\d{3})*(?:\.\d{1,2})?/g) || [];
  if (numbers.length === 0) return null;

  // Parse the numbers
  const parsed = numbers.map((n) => parseFloat(n.replace(/,/g, "")));
  const [min, max] = parsed.length >= 2 ? [Math.min(...parsed), Math.max(...parsed)] : [parsed[0], undefined];

  // Determine unit (default YEAR)
  let unitText: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" = "YEAR";
  if (/\/hour|per hour|\/hr|hourly/i.test(trimmed)) unitText = "HOUR";
  else if (/\/day|per day|daily/i.test(trimmed)) unitText = "DAY";
  else if (/\/week|per week|weekly/i.test(trimmed)) unitText = "WEEK";
  else if (/\/month|per month|monthly/i.test(trimmed)) unitText = "MONTH";
  else if (/per year|\/year|annually|\/annum/i.test(trimmed)) unitText = "YEAR";

  // Map currency symbol to ISO code
  const currencyCode: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
  };

  return {
    currency: currencyCode[currency] || "USD",
    value:
      min !== undefined
        ? {
            minValue: Math.round(min),
            maxValue: max && max !== min ? Math.round(max) : undefined,
            unitText,
          }
        : undefined,
  };
}

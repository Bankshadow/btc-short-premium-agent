/**
 * Parses manual dashboard inputs (CoinGlass-style strings) into numbers.
 * Returns null for empty or invalid values.
 */
export function parseManualNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (/%/.test(trimmed)) {
    const numStr = trimmed.replace(/[$,\s%]/g, "").replace(/^\+/, "");
    if (numStr === "" || numStr === "-") return null;
    const parsed = Number(numStr);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const normalized = trimmed.replace(/[$,\s]/g, "").replace(/^\+/, "");
  if (normalized === "" || normalized === "-") return null;

  const suffixMatch = normalized.match(/^(-?[\d.]+)([kmb])?$/i);
  if (!suffixMatch) return null;

  const base = Number(suffixMatch[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = (suffixMatch[2] ?? "").toUpperCase();
  const multipliers: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
  };

  if (suffix && !(suffix in multipliers)) return null;

  return suffix ? base * multipliers[suffix]! : base;
}

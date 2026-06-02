import type { CheckResult, CheckStatus } from "@/lib/types/market";

export type DisplayStatus = "PASS" | "FAIL" | "CAUTION" | "MISSING";

export const CORE_CHECK_IDS = [
  "check-1-macro",
  "check-2-iv-hv",
  "check-3-sd",
  "check-4-funding",
  "check-5-delta",
  "check-6-confluence",
  "check-7-atr",
  "check-8-combination",
] as const;

export const CHECK_LABELS: Record<(typeof CORE_CHECK_IDS)[number], string> = {
  "check-1-macro": "Macro Event",
  "check-2-iv-hv": "IV/HV",
  "check-3-sd": "SD Distance",
  "check-4-funding": "Funding",
  "check-5-delta": "Delta",
  "check-6-confluence": "Support/Resistance",
  "check-7-atr": "ATR Filter",
  "check-8-combination": "Combination Read",
};

export function toDisplayStatus(status: CheckStatus): DisplayStatus {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "warn":
      return "CAUTION";
    case "skip":
      return "MISSING";
  }
}

export function statusStyles(status: DisplayStatus): string {
  switch (status) {
    case "PASS":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "FAIL":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "CAUTION":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "MISSING":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export function formatUsd(value: number): string {
  if (value === 0) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatPct(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function filterCoreChecks(checks: CheckResult[]): CheckResult[] {
  return CORE_CHECK_IDS.map(
    (id) =>
      checks.find((c) => c.id === id) ?? {
        id,
        name: CHECK_LABELS[id],
        category: "market" as const,
        status: "skip" as const,
        message: "Check not evaluated.",
        weight: 1,
      },
  );
}

export function isSweetSpotDelta(delta: number): boolean {
  const abs = Math.abs(delta);
  return abs >= 0.13 && abs <= 0.15;
}

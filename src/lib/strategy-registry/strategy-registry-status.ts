import type { StrategyStatus } from "@/lib/validation/validation-types";
import type { StrategyRegistryStatus } from "./strategy-registry-types";

export function validationStatusToRegistry(
  status: StrategyStatus,
): StrategyRegistryStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "WATCHLIST":
      return "WATCHLIST";
    case "PAPER_ONLY":
      return "PAPER_TESTING";
    case "DISABLED":
      return "DISABLED";
    case "EXPERIMENTAL":
    default:
      return "DRAFT";
  }
}

export function computePerformanceScore(input: {
  winRate: number;
  avgR: number;
  sampleSize: number;
  maxDrawdown: number;
}): number {
  const sampleFactor = Math.min(1, input.sampleSize / 20);
  const winFactor = Math.min(1, input.winRate / 60);
  const rFactor = Math.min(1, Math.max(0, (input.avgR + 1) / 2));
  const ddPenalty = Math.min(30, input.maxDrawdown * 2);
  const raw =
    sampleFactor * 35 + winFactor * 30 + rFactor * 35 - ddPenalty;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export const PROMOTE_ORDER: StrategyRegistryStatus[] = [
  "DRAFT",
  "WATCHLIST",
  "PAPER_TESTING",
  "ACTIVE",
];

export function nextPromoteStatus(
  current: StrategyRegistryStatus,
): StrategyRegistryStatus | null {
  const i = PROMOTE_ORDER.indexOf(current);
  if (i < 0 || i >= PROMOTE_ORDER.length - 1) return null;
  return PROMOTE_ORDER[i + 1];
}

export function nextDemoteStatus(
  current: StrategyRegistryStatus,
): StrategyRegistryStatus | null {
  if (current === "DISABLED" || current === "DEPRECATED") return "WATCHLIST";
  if (current === "ACTIVE") return "WATCHLIST";
  if (current === "PAPER_TESTING") return "DRAFT";
  if (current === "WATCHLIST") return "DRAFT";
  return null;
}

import type { DataConfidenceLevel } from "./types";

const SEC = 1;
const MIN = 60 * SEC;

export interface FreshnessRuleResult {
  confidence: DataConfidenceLevel;
  issue?: string;
}

export function ageSecondsFromIso(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 1000));
}

/** Apply desk freshness thresholds to a numeric age in seconds. */
export function evaluateBtcPriceFreshness(ageSec: number | null): FreshnessRuleResult {
  if (ageSec == null) {
    return { confidence: "CRITICAL", issue: "BTC price timestamp missing" };
  }
  if (ageSec > 120) {
    return {
      confidence: "LOW",
      issue: `BTC price stale (${ageSec}s > 120s)`,
    };
  }
  if (ageSec > 30) {
    return {
      confidence: "MEDIUM",
      issue: `BTC price aging (${ageSec}s > 30s)`,
    };
  }
  return { confidence: "HIGH" };
}

export function evaluateFundingFreshness(ageSec: number | null): FreshnessRuleResult {
  if (ageSec == null) {
    return { confidence: "MEDIUM", issue: "Funding timestamp unknown — assume aging" };
  }
  if (ageSec > 15 * MIN) {
    return {
      confidence: "LOW",
      issue: `Funding data older than 15m (${Math.round(ageSec / 60)}m)`,
    };
  }
  return { confidence: "HIGH" };
}

export function evaluateLiquidationFreshness(ageSec: number | null): FreshnessRuleResult {
  if (ageSec == null) {
    return { confidence: "LOW", issue: "Liquidation feed timestamp unknown" };
  }
  if (ageSec > 30 * MIN) {
    return {
      confidence: "LOW",
      issue: `Liquidation data older than 30m (${Math.round(ageSec / 60)}m)`,
    };
  }
  return { confidence: "HIGH" };
}

export function evaluateMacroCalendarPresent(
  hasEventFlag: boolean | undefined,
): FreshnessRuleResult {
  if (hasEventFlag === undefined) {
    return { confidence: "LOW", issue: "Macro calendar status missing" };
  }
  return { confidence: "HIGH" };
}

export function evaluateManualDataFreshness(ageSec: number | null): FreshnessRuleResult {
  if (ageSec == null) {
    return { confidence: "MEDIUM", issue: "Manual override age unknown" };
  }
  if (ageSec > 4 * 60 * MIN) {
    return {
      confidence: "LOW",
      issue: `Manual override older than 4h (${Math.round(ageSec / 3600)}h)`,
    };
  }
  return { confidence: "HIGH" };
}

export function evaluateMockInProduction(isMock: boolean, isProduction: boolean): FreshnessRuleResult {
  if (isMock && isProduction) {
    return {
      confidence: "CRITICAL",
      issue: "MOCK data detected in production environment",
    };
  }
  if (isMock) {
    return { confidence: "MEDIUM", issue: "MOCK / demo data in use" };
  }
  return { confidence: "HIGH" };
}

export function evaluateOptionChainIntegrity(
  candidateCount: number,
  missingChainFields: string[],
): FreshnessRuleResult {
  if (candidateCount === 0 || missingChainFields.length > 0) {
    return {
      confidence: "CRITICAL",
      issue:
        candidateCount === 0
          ? "Option chain missing — no candidates"
          : `Option chain incomplete: ${missingChainFields.join(", ")}`,
    };
  }
  return { confidence: "HIGH" };
}

export function worstConfidence(
  levels: DataConfidenceLevel[],
): DataConfidenceLevel {
  const order: DataConfidenceLevel[] = ["CRITICAL", "LOW", "MEDIUM", "HIGH"];
  for (const level of order) {
    if (levels.includes(level)) return level;
  }
  return "HIGH";
}

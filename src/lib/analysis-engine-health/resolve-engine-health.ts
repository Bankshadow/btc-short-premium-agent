import type {
  EngineHealthCapability,
  EngineHealthCheck,
  EngineHealthSnapshot,
  EngineHealthStatus,
} from "./types";
import { ENGINE_HEALTH_CHECK_ORDER } from "./types";

const STATUS_RANK: Record<EngineHealthStatus, number> = {
  OK: 0,
  WARNING: 1,
  BLOCKED: 2,
};

export function resolveEngineHealthSummary(
  checks: EngineHealthCheck[],
): Pick<EngineHealthSnapshot, "summary" | "summaryLabel"> {
  let summary: EngineHealthStatus = "OK";
  for (const check of checks) {
    if (STATUS_RANK[check.status] > STATUS_RANK[summary]) {
      summary = check.status;
    }
  }

  const summaryLabel =
    summary === "OK" ? "Engine OK" : summary === "WARNING" ? "Warning" : "Blocked";

  return { summary, summaryLabel };
}

function capabilityFromChecks(
  checks: EngineHealthCheck[],
  field: "affectsAnalyze" | "affectsTrade" | "affectsLearn",
): EngineHealthCapability {
  const relevant = checks.filter((c) => c[field]);
  const blockers = relevant
    .filter((c) => c.status === "BLOCKED")
    .map((c) => c.message);
  const warnings = relevant
    .filter((c) => c.status === "WARNING")
    .map((c) => c.message);

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function resolveEngineHealthCapabilities(
  checks: EngineHealthCheck[],
): EngineHealthSnapshot["capabilities"] {
  return {
    analyze: capabilityFromChecks(checks, "affectsAnalyze"),
    trade: capabilityFromChecks(checks, "affectsTrade"),
    learn: capabilityFromChecks(checks, "affectsLearn"),
  };
}

export function sortEngineHealthChecks(checks: EngineHealthCheck[]): EngineHealthCheck[] {
  const order = new Map(ENGINE_HEALTH_CHECK_ORDER.map((id, index) => [id, index]));
  return [...checks].sort(
    (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
  );
}

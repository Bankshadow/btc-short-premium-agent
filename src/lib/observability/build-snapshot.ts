import { collectObservabilitySignals } from "./collect-signals";
import { buildPlatformHealthReport } from "./build-health-score";
import { promoteCriticalFailures } from "./incident-promotion";
import { saveObservabilityMetrics } from "./store";
import type { PlatformHealthReport } from "./types";

let cachedReport: PlatformHealthReport | null = null;
let cachedAt = 0;
const CACHE_MS = 15_000;

export async function buildObservabilitySnapshot(
  workspaceId = "server-default",
  options?: { promoteIncidents?: boolean; useCache?: boolean },
): Promise<PlatformHealthReport> {
  const useCache = options?.useCache !== false;
  if (useCache && cachedReport && Date.now() - cachedAt < CACHE_MS) {
    return cachedReport;
  }

  const signals = await collectObservabilitySignals(workspaceId);
  const report = buildPlatformHealthReport(signals);

  if (options?.promoteIncidents !== false) {
    await promoteCriticalFailures(report);
  }

  await saveObservabilityMetrics({ lastCollectedAt: report.generatedAt });
  cachedReport = report;
  cachedAt = Date.now();
  return report;
}

export function getCachedObservabilityReport(): PlatformHealthReport | null {
  return cachedReport;
}

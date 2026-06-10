import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { buildMicroLiveReadinessView } from "@/lib/live-readiness/readiness-evaluator";
import { getLiveSandboxStatus } from "@/lib/live-sandbox/live-dry-run";
import type { ProductionHealthResult } from "@/lib/audit/audit-types";

export async function runProductionHealthCheck(): Promise<ProductionHealthResult> {
  const engine = await runEngineHealthCheck();
  const readiness = await buildMicroLiveReadinessView();
  const sandbox = await getLiveSandboxStatus();
  const events = await getEvents();

  const issues: ProductionHealthResult["issues"] = [];
  if (engine.status === "BLOCKED") {
    issues.push({ code: "ENGINE_BLOCKED", message: engine.message });
  }
  if (readiness.gaps.length > 0) {
    issues.push({ code: "READINESS_GAPS", message: readiness.gaps.join("; ") });
  }
  const errors = events.filter((e) => e.type === "ERROR_RECORDED").length;
  if (errors > 0) {
    issues.push({ code: "ERROR_EVENTS", message: `${errors} ERROR_RECORDED events.` });
  }
  if (!sandbox.liveLocked) {
    issues.push({ code: "LIVE_NOT_LOCKED", message: "Live sandbox not locked." });
  }

  const status =
    issues.some((i) => i.code === "ENGINE_BLOCKED" || i.code === "LIVE_NOT_LOCKED")
      ? "CRITICAL"
      : issues.length > 0
        ? "WARNING"
        : "OK";

  const recommendation =
    status === "OK" && readiness.recommendation === "READY_FOR_CONTROLLED_MICRO_LIVE"
      ? "READY_FOR_CONTROLLED_MICRO_LIVE"
      : "NOT_READY";

  const result: ProductionHealthResult = {
    checkedAt: new Date().toISOString(),
    status,
    issues,
    recommendation,
  };

  await appendEvent({
    type: "PRODUCTION_HEALTH_CHECKED",
    environment: "testnet",
    payload: { ...result },
  });

  return result;
}

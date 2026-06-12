import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import { getDefaultEvidenceProjection } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("evidence", getDefaultEvidenceProjection(), async () => {
    const events = await readCoreEvents();
    const evidence = buildProjectionById("evidence", events) as EvidenceProgress;
    const progressPct =
      evidence.required > 0 ? Math.round((evidence.valid / evidence.required) * 100) : 0;
    return {
      ...evidence,
      validTrades: evidence.valid,
      requiredTrades: evidence.required,
      progressPct,
      rejectedTradeIds: evidence.trades
        .filter((t) => t.status === "REJECTED" || t.status === "PENDING")
        .map((t) => t.tradeId),
      readiness:
        evidence.readinessStatus === "READY_FOR_TESTNET_CONTINUATION" ||
        evidence.readinessStatus === "READY_FOR_CONTROLLED_TESTNET_AUTO_REVIEW"
          ? "READY"
          : "NOT_READY",
    };
  });
}

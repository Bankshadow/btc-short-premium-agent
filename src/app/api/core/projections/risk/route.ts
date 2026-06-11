import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import type { RiskProjection } from "@/lib/core/projections/risk-projection";
import { getDefaultRiskProjectionView } from "@/lib/core/projection-defaults";
import { runProjectionRoute } from "@/lib/core/projection-route";

export async function GET() {
  return runProjectionRoute("risk", getDefaultRiskProjectionView(), async () => {
    const events = await readCoreEvents();
    const risk = buildProjectionById("risk", events) as RiskProjection;
    return {
      ...risk,
      liveLocked: true as const,
      status: risk.portfolioBlocksExecution || risk.operatorKillSwitch ? "BLOCKED" : "SAFE",
      mode: "DEFENSIVE" as const,
      blockers: [
        ...(risk.operatorKillSwitch ? ["OPERATOR_KILL_SWITCH"] : []),
        ...(risk.portfolioBlocksExecution ? ["PORTFOLIO_RISK"] : []),
        ...(risk.enginePaused ? ["ENGINE_PAUSED"] : []),
      ],
      warnings: [],
    };
  });
}

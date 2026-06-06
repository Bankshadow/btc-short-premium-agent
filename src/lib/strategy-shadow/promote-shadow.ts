import { promoteQuantImport } from "@/lib/quant-strategy-importer/promote-import";
import { buildStrategyShadowReport } from "./build-report";
import { evaluatePromotionEligibility } from "./compute-metrics";
import { computeStrategyMetrics } from "./compute-metrics";
import { loadShadowTrades } from "./shadow-store";
import type { PromoteShadowInput } from "./types";
import { SHADOW_PROMOTION_RULES } from "./types";

export interface PromoteShadowResult {
  ok: boolean;
  message: string;
  sourceId: string;
  eligible: boolean;
  blockers: string[];
  promoted?: boolean;
  newStatus?: string;
}

export async function promoteFromShadow(
  input: PromoteShadowInput,
): Promise<PromoteShadowResult> {
  if (!input.humanApproval) {
    return {
      ok: false,
      message: "Human approval required for shadow promotion.",
      sourceId: input.sourceId,
      eligible: false,
      blockers: ["humanApproval must be true"],
    };
  }

  const trades = await loadShadowTrades();
  const metrics = computeStrategyMetrics(trades, input.sourceId);
  if (!metrics) {
    return {
      ok: false,
      message: `No shadow trades found for ${input.sourceId}. Run shadow replay first.`,
      sourceId: input.sourceId,
      eligible: false,
      blockers: ["No shadow sample data"],
    };
  }

  const { eligible, blockers } = evaluatePromotionEligibility(metrics);
  if (!eligible) {
    return {
      ok: false,
      message: `Shadow promotion blocked — ${blockers.join(" ")}`,
      sourceId: input.sourceId,
      eligible: false,
      blockers,
    };
  }

  const targetStatus = input.targetStatus ?? "READY_FOR_BACKTEST";
  const result = await promoteQuantImport({
    sourceId: input.sourceId,
    targetStatus,
    humanApproval: true,
    operatorNote:
      input.operatorNote ??
      `MVP 70 shadow promotion — ${metrics.closedTrades} trades, ${metrics.winRate}% win, ${metrics.shadowPnL}% net. Not live proof.`,
  });

  return {
    ok: result.ok,
    message: result.ok
      ? `Promoted ${input.sourceId} to ${targetStatus} based on shadow evidence (n=${metrics.closedTrades}, win ${metrics.winRate}%). Shadow results cannot count as live proof.`
      : result.message,
    sourceId: input.sourceId,
    eligible: true,
    blockers: [],
    promoted: result.ok,
    newStatus: result.ok ? targetStatus : undefined,
  };
}

export async function getShadowPromotionPreview(sourceId: string) {
  const report = await buildStrategyShadowReport();
  return report.promotionCandidates.find((c) => c.sourceId === sourceId) ?? null;
}

export { SHADOW_PROMOTION_RULES };

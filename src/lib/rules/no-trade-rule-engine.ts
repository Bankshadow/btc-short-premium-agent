import { getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { sumDailyPnl } from "@/lib/pnl/daily-pnl";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { isBinanceConnected } from "@/lib/execution/binance-testnet-status";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import type { SwarmAgreement } from "@/lib/analysis/scenario-context";
import type { RegimeTag } from "@/lib/regime/regime-types";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress-engine";
import { EVIDENCE_REQUIRED_TRADES } from "@/lib/evidence/evidence-types";
import type { NoTradeRuleTrigger, RuleEvaluationResult } from "./no-trade-rule-types";

const DAILY_LOSS_LIMIT_USD = 25;
const MAX_CONSECUTIVE_LOSSES = 3;

function countConsecutiveLosses(events: Awaited<ReturnType<typeof getEvents>>): number {
  const pnls = events
    .filter((e) => e.type === "PNL_REALIZED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  let streak = 0;
  for (const e of pnls) {
    if ((e.payload as { result?: string }).result === "LOSS") streak += 1;
    else break;
  }
  return streak;
}

function countRepeatedSetupFailures(events: Awaited<ReturnType<typeof getEvents>>): number {
  const pnls = events
    .filter((e) => e.type === "PNL_REALIZED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  let streak = 0;
  for (const e of pnls) {
    if ((e.payload as { result?: string }).result === "LOSS") streak += 1;
    else break;
  }
  return streak >= 2 ? streak : 0;
}

export async function evaluateNoTradeRules(input: {
  proposedVerdict: "TRADE" | "WAIT" | "BLOCKED";
  swarmAgreement: SwarmAgreement;
  regime: RegimeTag;
}): Promise<RuleEvaluationResult> {
  const triggered: NoTradeRuleTrigger[] = [];
  const events = await getEvents();
  const evidenceProgress = buildEvidenceProgressFromEvents(events);
  const evidenceCollectionActive =
    evidenceProgress.validTrades < EVIDENCE_REQUIRED_TRADES;
  const mission = buildMissionSnapshot(events);

  const health = await runEngineHealthCheck();
  if (health.status === "BLOCKED" || health.blocksExecution) {
    triggered.push({
      code: "ENGINE_HEALTH_BLOCKED",
      message: health.message,
      severity: "BLOCK",
    });
  }

  const openTrades = buildOpenTradesFromEvents(events);
  const reconciliation = await getReconciliationStatus();
  if (reconciliation.status === "BLOCKED" && openTrades.length > 0) {
    triggered.push({
      code: "RECONCILIATION_BLOCKED",
      message: "Position reconciliation is BLOCKED with open trades.",
      severity: "BLOCK",
    });
  }

  const binanceStatus = await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS);
  const mockTradeExplicit =
    process.env.V2_MVP2_MOCK_TRADE?.trim().toLowerCase() === "true" ||
    process.env.V2_MVP2_MOCK_TRADE?.trim() === "1";
  const mockConnected =
    process.env.BINANCE_TESTNET_MOCK_CONNECTED?.trim().toLowerCase() === "true";
  if (!isBinanceConnected(binanceStatus) && !mockTradeExplicit && !mockConnected) {
    triggered.push({
      code: "BINANCE_DISCONNECTED",
      message: "Binance testnet is not connected.",
      severity: "BLOCK",
    });
  }

  const dailyPnl = sumDailyPnl(events);
  if (dailyPnl <= -DAILY_LOSS_LIMIT_USD) {
    triggered.push({
      code: "DAILY_LOSS_LIMIT",
      message: `Daily PnL $${dailyPnl.toFixed(2)} exceeds daily loss limit.`,
      severity: "BLOCK",
    });
  }

  const consecutiveLosses = countConsecutiveLosses(events);
  if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES && input.proposedVerdict === "TRADE") {
    triggered.push({
      code: "CONSECUTIVE_LOSSES",
      message: `${consecutiveLosses} consecutive losses recorded.`,
      severity: evidenceCollectionActive ? "WARN" : "BLOCK",
    });
  }

  if (input.swarmAgreement === "DISAGREE" && input.proposedVerdict === "TRADE") {
    triggered.push({
      code: "AGENT_DISAGREEMENT_HIGH",
      message: "Analysis verdict disagrees with swarm advisory signal.",
      severity: "WARN",
    });
  }

  if (input.regime === "UNKNOWN" && input.proposedVerdict === "TRADE") {
    triggered.push({
      code: "REGIME_UNKNOWN_HIGH_VOL",
      message: "Regime UNKNOWN — confidence reduced, trade discouraged.",
      severity: "WARN",
    });
  }

  const setupFailures = countRepeatedSetupFailures(events);
  if (setupFailures >= 2 && input.proposedVerdict === "TRADE") {
    triggered.push({
      code: "REPEATED_SETUP_FAILURE",
      message: `${setupFailures} recent consecutive losses on similar setups.`,
      severity: evidenceCollectionActive ? "WARN" : "BLOCK",
    });
  }

  const blockers = triggered.filter((t) => t.severity === "BLOCK");
  const blocked = blockers.length > 0 && input.proposedVerdict === "TRADE";

  return {
    evaluatedAt: new Date().toISOString(),
    triggered,
    blocked,
    blockReason: blocked ? blockers.map((b) => b.code).join(", ") : null,
    message:
      triggered.length === 0
        ? "No-trade rules passed."
        : `${triggered.length} rule(s) triggered.`,
  };
}

import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { isBinanceFuturesOnlyMode } from "@/lib/market-data/provider";
import { resolvePrimaryStrategyHealth } from "@/lib/mission-flow/resolve-primary-strategy-health";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import {
  isBinanceForceMaxAutopilotEnabled,
  isBinanceTestnetAutoExecuteEnabled,
} from "./binance-config";
import type { MonitorReliabilitySnapshot } from "@/lib/monitor-reliability/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { MissionMode } from "@/lib/mission-controller-risk-budget/types";

export interface UnifiedTestnetTradeGateInput {
  analysis: AnalyzeApiResponse | null;
  commandCenterStatus?: string | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  monitorReliability?: MonitorReliabilitySnapshot | null;
  integratedStrategyHealth?: IntegratedStrategyHealthSnapshot | null;
  consistencyBlocksNewTrades?: boolean;
  consistencyIssue?: string | null;
  missionMode?: MissionMode | null;
  missionNextAction?: string | null;
}

export interface UnifiedTestnetTradeGateResult {
  allowed: boolean;
  blockReasons: string[];
  mode: "disabled" | "force_max" | "futures_only" | "standard";
}

/**
 * Single permission layer for Binance testnet autoexecute — replaces scattered
 * committee / data-trust / strategy checks at the executor entry point.
 */
export function evaluateUnifiedTestnetTradeGate(
  input: UnifiedTestnetTradeGateInput,
): UnifiedTestnetTradeGateResult {
  if (!isBinanceTestnetAutoExecuteEnabled()) {
    return { allowed: false, blockReasons: ["Autoexecute disabled."], mode: "disabled" };
  }

  const forceMax = isBinanceForceMaxAutopilotEnabled();
  const futuresOnly = isBinanceFuturesOnlyMode();
  const blockReasons: string[] = [];

  if (input.monitorReliability?.blocksNewEntries) {
    blockReasons.push(
      input.monitorReliability.currentIssue ??
        "Position state uncertain — monitor recovery required before new entries.",
    );
  }

  if (input.consistencyBlocksNewTrades) {
    blockReasons.push(
      input.consistencyIssue ??
        "Engine consistency reconciliation blocked — position state uncertain.",
    );
  }

  if (input.integratedStrategyHealth?.blocksNewTestnetEntries) {
    blockReasons.push(
      input.integratedStrategyHealth.primaryReport?.recommendation ??
        "Strategy health PAUSE/REJECT — testnet entries blocked pending review.",
    );
  }

  if (input.missionMode === "PAUSED" || input.missionMode === "COOLDOWN") {
    blockReasons.push(
      input.missionNextAction ??
        (input.missionMode === "COOLDOWN"
          ? "Mission COOLDOWN — reduce activity until metrics recover."
          : "Mission PAUSED — daily loss limit or critical blocker."),
    );
  }

  const cc = input.commandCenterStatus?.toUpperCase() ?? null;
  const testnetPrimary = isTestnetPrimaryAutomation();
  if (
    (cc === "BLOCKED" || cc === "EMERGENCY") &&
    !forceMax &&
    !testnetPrimary
  ) {
    blockReasons.push(`Command center ${cc} — testnet entries paused.`);
  }

  if (
    input.analysis?.dataTrust?.grade === "CRITICAL" &&
    !forceMax &&
    !futuresOnly
  ) {
    blockReasons.push(
      input.analysis.dataTrust.criticalIssues[0] ?? "Data trust CRITICAL.",
    );
  }

  if (input.entries && input.orders && !forceMax) {
    const kill = evaluateKillSwitch({
      entries: input.entries,
      orders: input.orders,
      riskProfile: getDeskRiskProfile(),
    });
    if (kill.tradingPaused) {
      blockReasons.push(kill.messages[0] ?? "Kill switch active.");
    }

    const strategy = resolvePrimaryStrategyHealth(
      buildStrategyHealthSummary({
        entries: input.entries,
        orders: input.orders,
      }),
    );
    if (strategy && !strategy.tradeAllowed && !testnetPrimary) {
      blockReasons.push(strategy.blockReason ?? "Strategy health blocked new trades.");
    }
  }

  const mode = forceMax ? "force_max" : futuresOnly ? "futures_only" : "standard";
  return { allowed: blockReasons.length === 0, blockReasons, mode };
}

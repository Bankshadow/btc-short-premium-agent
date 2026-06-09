import type { AnalyzeApiResponse } from "@/lib/types/market";
import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { isAggressiveDeskRisk } from "@/lib/desk/desk-risk-policy";
import { isBinanceFuturesOnlyMode } from "@/lib/market-data/provider";
import { isBinanceForceMaxAutopilotEnabled } from "./binance-config";

function normalizeVerdict(value: unknown): string {
  return String(value ?? "WAIT").toUpperCase();
}

function step5Verdict(analysis: AnalyzeApiResponse | null): string {
  return normalizeVerdict(analysis?.step5_verdict?.recommendation);
}

function weightedVerdict(analysis: AnalyzeApiResponse | null): string {
  return normalizeVerdict(
    analysis?.tradingDesk?.weightedCommittee?.weightedVerdict ??
      analysis?.step5_verdict?.recommendation ??
      "WAIT",
  );
}

function committeeFinalVerdict(analysis: AnalyzeApiResponse | null): string | null {
  const raw = analysis?.tradingDesk?.committee?.finalVerdict;
  return raw ? normalizeVerdict(raw) : null;
}

export function resolveCommitteeConfidence(analysis: AnalyzeApiResponse | null): number {
  return (
    analysis?.tradingDesk?.weightedCommittee?.tradeScore ??
    analysis?.step5_verdict?.confidence ??
    0
  );
}

/**
 * Single testnet execution verdict — used by autopilot pick, autoexec, and monitor
 * so committee / step5 / scanner paths stay aligned without bypassing iron gates.
 */
export function resolveTestnetExecutionVerdict(
  analysis: AnalyzeApiResponse | null,
): string {
  const step5 = step5Verdict(analysis);
  const weighted = weightedVerdict(analysis);
  const finalCommittee = committeeFinalVerdict(analysis);
  const forceMax = isBinanceForceMaxAutopilotEnabled();
  const futuresOnly = isBinanceFuturesOnlyMode();
  const testnetPrimary = isTestnetPrimaryAutomation();

  if (forceMax) {
    if (step5 === "TRADE" || weighted === "TRADE" || finalCommittee === "TRADE") {
      return "TRADE";
    }
    return weighted;
  }

  if (futuresOnly && finalCommittee) {
    return finalCommittee;
  }

  // Learning phase: desk step5 TRADE is actionable when weighted committee is conservative.
  if (
    testnetPrimary &&
    step5 === "TRADE" &&
    (weighted === "SKIP" || weighted === "WAIT")
  ) {
    return "TRADE";
  }

  return weighted;
}

/** Whether the desk verdict alone allows a trade cycle (scanner may still add candidates). */
export function isTestnetTradeCycleAllowed(
  analysis: AnalyzeApiResponse | null,
  verdict?: string,
): boolean {
  const resolved = verdict ?? resolveTestnetExecutionVerdict(analysis);
  if (resolved === "TRADE") return true;
  if (!isAggressiveDeskRisk()) return false;
  const confidence = resolveCommitteeConfidence(analysis);
  return resolved === "WAIT" && confidence >= 52;
}

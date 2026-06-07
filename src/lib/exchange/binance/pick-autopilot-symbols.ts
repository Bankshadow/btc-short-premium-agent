import type { AnalyzeApiResponse } from "@/lib/types/market";
import { runMultiAssetScan } from "@/lib/multi-asset/multi-asset-scanner";
import { runMultiTimeframeScan } from "@/lib/multi-asset/multi-timeframe-scanner";
import { TIMEFRAME_HORIZON_CONFIG } from "@/lib/multi-asset/timeframe-chart-logic";
import type { TimeframeChartSignal } from "@/lib/multi-asset/timeframe-types";
import { SUPPORTED_PERP_ASSETS } from "@/lib/multi-asset/asset-config";
import type { PerpDirection } from "@/lib/multi-asset/types";
import { isAggressiveDeskRisk } from "@/lib/desk/desk-risk-policy";
import { isBinanceFuturesOnlyMode } from "@/lib/market-data/provider";
import {
  isMultiTimeframeAutopilotEnabled,
  loadBinanceConfig,
} from "./binance-config";
import {
  inferBinanceSideFromAnalysis,
  inferBinanceSymbolFromAnalysis,
} from "./build-ai-preview";
import { shouldRotateOutSymbol } from "./symbol-rotation-store";
import type { BinanceOrderSide } from "./binance-types";

const AGGRESSIVE_SCAN_SCORE = 35;
const AGGRESSIVE_MULT_TF_SCORE = 25;

export interface AutopilotTradeCandidate {
  symbol: string;
  side: BinanceOrderSide;
  score: number;
  source: "scanner" | "desk";
  reason: string;
  timeframe?: string;
}

function resolveCommitteeVerdict(data: AnalyzeApiResponse | null): string {
  const finalVerdict = data?.tradingDesk?.committee?.finalVerdict;
  const weighted =
    data?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    data?.step5_verdict?.recommendation ??
    "WAIT";
  const normalized = String(weighted).toUpperCase();
  if (isBinanceFuturesOnlyMode() && finalVerdict) {
    return String(finalVerdict).toUpperCase();
  }
  return normalized;
}

function resolveCommitteeConfidence(data: AnalyzeApiResponse | null): number {
  return (
    data?.tradingDesk?.weightedCommittee?.tradeScore ??
    data?.step5_verdict?.confidence ??
    0
  );
}

function perpDirectionToSide(direction: PerpDirection): BinanceOrderSide | null {
  if (direction === "LONG") return "BUY";
  if (direction === "SHORT") return "SELL";
  return null;
}

function isTradeCycleAllowed(
  analysis: AnalyzeApiResponse | null,
  verdict: string,
): boolean {
  if (verdict === "TRADE") return true;
  if (!isAggressiveDeskRisk()) return false;
  const confidence = resolveCommitteeConfidence(analysis);
  return verdict === "WAIT" && confidence >= 52;
}

function isSignalActionable(
  signal: TimeframeChartSignal,
  aggressive: boolean,
): boolean {
  if (signal.actionable) return true;
  const threshold =
    TIMEFRAME_HORIZON_CONFIG[signal.horizon].actionableScore -
    (aggressive ? 5 : 0);
  return (
    aggressive &&
    signal.dataFresh &&
    Math.abs(signal.score) >= Math.min(threshold, AGGRESSIVE_MULT_TF_SCORE)
  );
}

async function buildCandidatesFromTimeframeScan(
  signals: TimeframeChartSignal[],
  allowed: Set<string>,
  openSet: Set<string>,
  aggressive: boolean,
): Promise<AutopilotTradeCandidate[]> {
  const bySymbol = new Map<string, TimeframeChartSignal[]>();
  for (const signal of signals) {
    if (!allowed.has(signal.symbol) || openSet.has(signal.symbol)) continue;
    if (!(await shouldRotateOutSymbol(signal.symbol))) continue;
    if (!isSignalActionable(signal, aggressive)) continue;
    const list = bySymbol.get(signal.symbol) ?? [];
    list.push(signal);
    bySymbol.set(signal.symbol, list);
  }

  const candidates: AutopilotTradeCandidate[] = [];
  for (const [, tfSignals] of bySymbol) {
    const sorted = [...tfSignals].sort(
      (a, b) => Math.abs(b.score) - Math.abs(a.score),
    );
    const best = sorted[0];
    const side = perpDirectionToSide(best.direction);
    if (!side) continue;

    const aligned = sorted.filter((s) => s.direction === best.direction);
    let score = Math.abs(best.score);
    if (aligned.length >= 2) score += 10 * (aligned.length - 1);
    if (aligned.length >= 3) score += 15;

    candidates.push({
      symbol: best.symbol,
      side,
      score,
      source: "scanner",
      timeframe: aligned.map((s) => s.horizon).join("+"),
      reason:
        aligned.length >= 2
          ? `${aligned.length}-TF ${best.direction} (${aligned.map((s) => s.horizonLabel).join(" + ")}) · score ${best.score}`
          : `${best.horizonLabel} ${best.direction} · score ${best.score}`,
    });
  }
  return candidates;
}

/**
 * Ranks multi-asset / multi-timeframe scanner signals with desk committee bias.
 * Skips symbols already open or on a 3-cycle skip rotation.
 */
export async function pickAutopilotTradeCandidates(input: {
  analysis: AnalyzeApiResponse | null;
  openSymbols: string[];
  maxCandidates?: number;
}): Promise<AutopilotTradeCandidate[]> {
  const config = loadBinanceConfig();
  const allowed = new Set(config.allowedSymbols.map((s) => s.toUpperCase()));
  const openSet = new Set(input.openSymbols.map((s) => s.toUpperCase()));
  const verdict = resolveCommitteeVerdict(input.analysis);
  const futuresOnly = isBinanceFuturesOnlyMode();
  const multiTf = isMultiTimeframeAutopilotEnabled();

  if (futuresOnly) {
    if (input.analysis?.dataTrust?.grade === "CRITICAL") {
      return [];
    }
  } else if (!isTradeCycleAllowed(input.analysis, verdict)) {
    return [];
  }

  const candidates: AutopilotTradeCandidate[] = [];
  const aggressive = isAggressiveDeskRisk();
  const scannable = SUPPORTED_PERP_ASSETS.filter((a) => allowed.has(a.symbol));

  if (multiTf) {
    const scan = await runMultiTimeframeScan(scannable);
    candidates.push(
      ...(await buildCandidatesFromTimeframeScan(
        scan.signals,
        allowed,
        openSet,
        aggressive,
      )),
    );
  } else {
    const scan = await runMultiAssetScan(scannable);
    for (const signal of scan.signals) {
      if (!allowed.has(signal.symbol) || openSet.has(signal.symbol)) continue;
      if (await shouldRotateOutSymbol(signal.symbol)) continue;

      if (signal.actionable) {
        const side = perpDirectionToSide(signal.direction);
        if (!side) continue;
        candidates.push({
          symbol: signal.symbol,
          side,
          score: Math.abs(signal.score),
          source: "scanner",
          reason: `Scan ${signal.direction} · score ${signal.score}`,
        });
        continue;
      }

      if (
        aggressive &&
        signal.dataFresh &&
        Math.abs(signal.score) >= AGGRESSIVE_SCAN_SCORE
      ) {
        candidates.push({
          symbol: signal.symbol,
          side: signal.score >= 0 ? "BUY" : "SELL",
          score: Math.abs(signal.score),
          source: "scanner",
          reason: `Aggressive scan bias · score ${signal.score}`,
        });
      }
    }
  }

  const deskSymbol = inferBinanceSymbolFromAnalysis(input.analysis);
  const deskSide = inferBinanceSideFromAnalysis(input.analysis);
  if (
    allowed.has(deskSymbol) &&
    !openSet.has(deskSymbol) &&
    !(await shouldRotateOutSymbol(deskSymbol))
  ) {
    const existing = candidates.find((c) => c.symbol === deskSymbol);
    if (existing) {
      existing.score += verdict === "TRADE" ? 25 : 10;
      existing.reason = `${existing.reason} · desk ${verdict}`;
    } else {
      candidates.push({
        symbol: deskSymbol,
        side: deskSide,
        score: verdict === "TRADE" ? 100 : 60,
        source: "desk",
        reason: `Desk committee ${verdict}`,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique: AutopilotTradeCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.symbol)) continue;
    seen.add(candidate.symbol);
    unique.push(candidate);
  }

  const max = input.maxCandidates ?? config.maxOpenPositions;
  return unique.slice(0, max);
}

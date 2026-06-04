import type {
  AnalyzeApiResponse,
  DataSourceError,
  DecisionEngineInput,
  OptionCandidate,
  SpotQuote,
  TradeRecommendation,
} from "@/lib/types/market";
import type {
  AgentOutput,
  AgentRecommendation,
  ConfidenceLevel,
} from "./types";
import { tradeRecToAgent } from "./types";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import { LIQUIDATION_SKIP } from "@/lib/decision/thresholds";

export const TRADING_DESK_DISCLAIMER =
  "TradingAgents-style crypto desk (Bybit) — analysis only. Human approval required. No auto execution.";

export const MAX_DAILY_LOSS_PCT = 3;
export const MAX_CONSECUTIVE_LOSSES_SKIP = 3;

export const CRITICAL_DATA_FIELDS = [
  "BTC spot price",
  "HV30",
  "IV",
  "IV/HV ratio",
  "option chain",
  "liquidation 24h",
] as const;

export interface TradingDeskContext {
  input: DecisionEngineInput;
  response: AnalyzeApiResponse;
  sourceErrors: DataSourceError[];
  /** Set true when desk detects daily loss budget exhausted */
  dailyLossLimitHit?: boolean;
  /** MVP 4 — read-only memory bullets for agents */
  deskMemoryBullets?: string[];
  deskMemoryRegime?: string;
  deskMemoryPayload?: DeskMemoryClientPayload;
  /** MVP 5 — research layer bullets for downstream agents */
  researchBullets?: string[];
  ethQuote?: SpotQuote | null;
}

export function buildTradingDeskContext(
  input: DecisionEngineInput,
  response: AnalyzeApiResponse,
): TradingDeskContext {
  const consecutive = input.consecutiveLosses ?? 0;
  return {
    input,
    response,
    sourceErrors: response.sourceErrors ?? response.dataSourceIssues ?? [],
    dailyLossLimitHit: consecutive >= 2,
  };
}

export function selectBestOptionCandidate(
  candidates: OptionCandidate[],
): OptionCandidate | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort(
    (a, b) =>
      Math.abs(Math.abs(a.delta) - 0.14) - Math.abs(Math.abs(b.delta) - 0.14),
  )[0];
}

export function getMissingDataLabels(ctx: TradingDeskContext): string[] {
  const missing = ctx.response.step5_verdict.missingData ?? [];
  if (missing.length > 0) {
    return missing.map((f) => f.replace(/^market\./, "BTC "));
  }

  const labels: string[] = [];
  const market = ctx.input.market;
  if (market.spotPrice <= 0) labels.push("BTC spot price");
  if (market.hv30 <= 0) labels.push("HV30");
  if (market.iv <= 0) labels.push("IV");
  if (market.ivHvRatio <= 0) labels.push("IV/HV ratio");
  if (ctx.input.optionCandidates.length === 0) labels.push("option chain");
  if (ctx.input.liquidation.liquidation24h == null) {
    labels.push("liquidation 24h");
  }
  return labels;
}

export function resolveMarketRegime(ctx: TradingDeskContext): string {
  const { market, liquidation, macroEvent } = ctx.input;
  const daily = ctx.input.technicalDaily;
  const combo = ctx.response.step4_combinationRead;
  const liq = liquidation.liquidation24h;

  if (macroEvent.hasEventBeforeSettlement) return "Macro caution";
  if (liq != null && liq > LIQUIDATION_SKIP) return "Liquidation stress";
  if (combo.pattern === "long_capitulation") return "Long capitulation / stress";
  if (daily.trend === "bullish" && (market.priceChange24hPct ?? 0) > 0) {
    return "Risk-on trend";
  }
  if (daily.trend === "bearish" && (market.priceChange24hPct ?? 0) < 0) {
    return "Risk-off trend";
  }
  if (daily.trend === "neutral") return "Range-bound";
  if (getMissingDataLabels(ctx).length > 0) return "Unclear (partial data)";
  return "Mixed / unclear";
}

export function toConfidenceLevel(
  score: number,
  recommendation?: AgentRecommendation,
): ConfidenceLevel {
  if (recommendation === "SKIP" && score >= 85) return "HIGH";
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export function formatProposedAction(parts: {
  instrument: string;
  side?: string;
  sizePct?: number;
  notes: string;
}): string {
  const size =
    parts.sizePct && parts.sizePct > 0
      ? ` · size ${parts.sizePct}% (hypothetical)`
      : "";
  const side = parts.side && parts.side !== "none" ? ` · ${parts.side}` : "";
  return `${parts.instrument}${side}${size} — ${parts.notes}`;
}

type AgentOutputDraft = Omit<AgentOutput, "missingData" | "proposedAction" | "confidence"> & {
  confidence: ConfidenceLevel | number;
  proposedAction?: string;
  missingData?: string[];
};

export function buildAgentOutput(
  partial: AgentOutputDraft,
  ctx?: TradingDeskContext,
): AgentOutput {
  const missingData = partial.missingData ?? (ctx ? getMissingDataLabels(ctx) : []);
  const proposedAction =
    partial.proposedAction ?? "No execution — analysis only.";
  const confidence =
    typeof partial.confidence === "string"
      ? partial.confidence
      : toConfidenceLevel(partial.confidence, partial.recommendation);

  const { confidence: _c, missingData: _m, proposedAction: _p, ...rest } = partial;

  return {
    ...rest,
    confidence,
    proposedAction,
    missingData,
  };
}

export function fromEngineRecommendation(
  rec: TradeRecommendation,
  confidenceScore: number,
): { recommendation: AgentRecommendation; confidence: ConfidenceLevel } {
  const recommendation = tradeRecToAgent(rec);
  return {
    recommendation,
    confidence: toConfidenceLevel(confidenceScore, recommendation),
  };
}

/** Prepend desk memory context to agent reasons (advisory only). */
export function withDeskMemoryReasons(
  ctx: TradingDeskContext,
  reasons: string[],
): string[] {
  const researchLines = (ctx.researchBullets ?? [])
    .slice(0, 1)
    .map((b) => `[Research] ${b}`);
  const memoryLines = (ctx.deskMemoryBullets ?? [])
    .slice(0, 2)
    .map((b) => `[Memory] ${b}`);
  if (researchLines.length === 0 && memoryLines.length === 0) return reasons;
  return [...researchLines, ...memoryLines, ...reasons];
}

export function majorityRecommendation(
  recs: AgentRecommendation[],
): AgentRecommendation {
  const counts = { TRADE: 0, SKIP: 0, WAIT: 0 };
  for (const r of recs) counts[r] += 1;
  if (counts.SKIP >= counts.TRADE && counts.SKIP >= counts.WAIT) return "SKIP";
  if (counts.TRADE > counts.SKIP && counts.TRADE > counts.WAIT) return "TRADE";
  if (counts.WAIT > counts.TRADE) return "WAIT";
  return "SKIP";
}

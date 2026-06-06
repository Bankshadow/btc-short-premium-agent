import { fetchMarketSnapshot, fetchOptionCandidates } from "@/lib/bybit/market";
import { getBtcKlines } from "@/lib/bybit/klines";
import { buildTechnicalSnapshot, type Candle } from "@/lib/indicators/technical";
import type {
  AnalysisInput,
  AnalysisResult,
  AnalyzeApiResponse,
  DataSourceError,
  DecisionEngineInput,
  DecisionEngineOutput,
  LiquidationData,
  MacroEventStatus,
  DerivativesOverrides,
} from "@/lib/types/market";
import { applyDerivativesOverrides } from "./apply-overrides";
import { attachTradingDesk } from "@/lib/agents/run-trading-desk";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import { applyDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import type { SpotQuote } from "@/lib/types/market";
import type { AdvisoryStrategySignal } from "@/lib/strategy-signals/types";
import type { SecondBrainCycleSnapshot } from "@/lib/second-brain/types";
import { buildAnalyzeApiResponse } from "./analyze-response";
import { runDecisionEngine } from "./engine";
import { hasAnyOverride, hasOverrideForField } from "./derivatives-overrides";
import {
  BYBIT_API_FAILED_MESSAGE,
  isBybitCriticalFailure,
  MANUAL_DERIVATIVES_MESSAGE,
} from "./bybit-health";

export { runDecisionEngine } from "./engine";

const DEFAULT_LIQUIDATION: LiquidationData = {
  liquidation24h: null,
  source: "mock",
};

function klineToCandle(
  klines: Awaited<ReturnType<typeof getBtcKlines>>,
): Candle[] {
  return klines.map((k) => ({
    timestamp: k.openTime,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function fetchKlinesWithReport(
  interval: "60" | "240" | "D",
  sourceErrors: DataSourceError[],
): Promise<Awaited<ReturnType<typeof getBtcKlines>>> {
  try {
    const klines = await getBtcKlines(interval);
    if (klines.length === 0) {
      sourceErrors.push({
        source: `Bybit Klines (${interval})`,
        message: "No candle data returned.",
      });
    }
    return klines;
  } catch (error) {
    sourceErrors.push({
      source: `Bybit Klines (${interval})`,
      message: errorMessage(error),
    });
    return [];
  }
}

function withAppliedOverrides(
  input: DecisionEngineInput,
  derivativesOverrides?: DerivativesOverrides,
): DecisionEngineInput {
  const resolved = derivativesOverrides ?? input.derivativesOverrides;
  if (!resolved || !hasAnyOverride(resolved)) {
    return input;
  }

  const { market, liquidation } = applyDerivativesOverrides(
    input.market,
    input.liquidation,
    resolved,
  );

  return {
    ...input,
    market,
    liquidation,
    derivativesOverrides: resolved,
  };
}

async function buildEngineInput(
  overrides: Partial<DecisionEngineInput> & AnalysisInput = {},
): Promise<{ input: DecisionEngineInput; sourceErrors: DataSourceError[] }> {
  const sourceErrors: DataSourceError[] = [];
  const derivativesOverrides = overrides.derivativesOverrides;

  let marketRaw = overrides.market;
  if (!marketRaw) {
    try {
      marketRaw = await fetchMarketSnapshot();
      if (marketRaw.spotPrice <= 0) {
        sourceErrors.push({
          source: "Bybit Ticker",
          message: "BTC spot price unavailable or zero.",
        });
      }
    } catch (error) {
      sourceErrors.push({
        source: "Bybit Ticker",
        message: errorMessage(error),
      });
      marketRaw = {
        symbol: "BTCUSDT",
        spotPrice: 0,
        timestamp: new Date().toISOString(),
        hv30: 0,
        iv: 0,
        ivHvRatio: 0,
        ivRank: 0,
        ivPercentile: 0,
        fundingRate: 0,
        openInterestBtc: 0,
        oiChange24hPct: null,
        oiChange1hPct: null,
        volume24hBtc: 0,
        volumeChange24hPct: null,
        priceChange24hPct: null,
      };
    }
  }

  let candidates = overrides.optionCandidates;
  if (!candidates) {
    try {
      candidates = await fetchOptionCandidates();
      if (candidates.length === 0) {
        sourceErrors.push({
          source: "Bybit Options",
          message: "No option candidates returned from chain.",
        });
      }
    } catch (error) {
      sourceErrors.push({
        source: "Bybit Options",
        message: errorMessage(error),
      });
      candidates = [];
    }
  }

  const [dailyKlines, h4Klines, h1Klines] = await Promise.all([
    fetchKlinesWithReport("D", sourceErrors),
    fetchKlinesWithReport("240", sourceErrors),
    fetchKlinesWithReport("60", sourceErrors),
  ]);

  const marketBase: DecisionEngineInput["market"] = {
    ...marketRaw,
    oiChange24hPct: marketRaw.oiChange24hPct ?? null,
    oiChange1hPct: marketRaw.oiChange1hPct ?? null,
    volumeChange24hPct: marketRaw.volumeChange24hPct ?? null,
    priceChange24hPct: marketRaw.priceChange24hPct ?? null,
  };

  const macroEvent: MacroEventStatus = overrides.macroEvent ?? {
    hasEventBeforeSettlement: overrides.macroEventToday ?? false,
  };

  let liquidation: LiquidationData =
    overrides.liquidation ?? DEFAULT_LIQUIDATION;

  const { market, liquidation: mergedLiquidation } = applyDerivativesOverrides(
    marketBase,
    liquidation,
    derivativesOverrides,
  );
  liquidation = mergedLiquidation;

  sourceErrors.push(
    ...collectDerivativesSourceErrors(
      market,
      liquidation,
      derivativesOverrides,
    ),
  );

  const dailyCandles = klineToCandle(dailyKlines);
  const h4Candles = klineToCandle(h4Klines);
  const h1Candles = klineToCandle(h1Klines);

  const symbol = market.symbol;

  return {
    input: {
      market,
      optionCandidates: candidates,
      technicalDaily: buildTechnicalSnapshot(symbol, dailyCandles, []),
      technical4h: buildTechnicalSnapshot(symbol, h4Candles, h4Candles),
      technical1h: buildTechnicalSnapshot(symbol, h1Candles, []),
      macroEvent,
      liquidation,
      macroView: overrides.macroView ?? "neutral",
      consecutiveLosses: overrides.consecutiveLosses,
      priorDayRallyPct: overrides.priorDayRallyPct,
      derivativesOverrides,
    },
    sourceErrors,
  };
}

function collectDerivativesSourceErrors(
  market: DecisionEngineInput["market"],
  liquidation: LiquidationData,
  derivativesOverrides?: DerivativesOverrides,
): DataSourceError[] {
  const sourceErrors: DataSourceError[] = [];
  const overrides = derivativesOverrides ?? {};
  const hasManualDerivatives = hasAnyOverride(overrides);

  if (hasManualDerivatives) {
    sourceErrors.push({
      source: "Manual Overrides",
      message: MANUAL_DERIVATIVES_MESSAGE,
    });
  }

  if (
    !hasOverrideForField(overrides, "liquidation24h") &&
    liquidation.liquidation24h === null
  ) {
    sourceErrors.push({
      source: "Liquidation",
      message:
        "Liquidation data unavailable — enter liquidation24h in Manual Overrides.",
    });
  }

  const missingOi = [
    !hasOverrideForField(overrides, "oi24hChange") &&
      market.oiChange24hPct === null &&
      "oi24hChange",
    !hasOverrideForField(overrides, "oi1hChange") &&
      market.oiChange1hPct === null &&
      "oi1hChange",
  ].filter(Boolean) as string[];

  if (missingOi.length > 0) {
    sourceErrors.push({
      source: "Open Interest",
      message: `Combination Read is partial because OI data is missing (${missingOi.join(", ")}).`,
    });
  }

  if (
    !hasOverrideForField(overrides, "volume24hChange") &&
    market.volumeChange24hPct === null
  ) {
    sourceErrors.push({
      source: "Volume",
      message:
        "Combination Read is partial because volume24hChange is missing.",
    });
  }

  return sourceErrors;
}

/** Run engine on pre-fetched input (e.g. browser-side Bybit fetch on Vercel). */
export function runDecisionEngineFromInput(
  input: DecisionEngineInput,
  derivativesOverrides?: DerivativesOverrides,
  deskMemory?: DeskMemoryClientPayload,
  ethQuote?: SpotQuote | null,
  strategyRegistry?: StrategyRegistryAnalyzePayload | null,
  governance?: GovernanceAnalyzePayload | null,
  adaptiveWeighting?: import("@/lib/adaptive-agent-weighting/types").AdaptiveWeightingAnalyzePayload | null,
  advisoryStrategySignals: AdvisoryStrategySignal[] = [],
  secondBrain?: SecondBrainCycleSnapshot | null,
): AnalyzeApiResponse {
  applyDeskRiskProfile(input.deskRiskProfile);
  const engineInput = withAppliedOverrides(input, derivativesOverrides);
  const resolvedOverrides = engineInput.derivativesOverrides;

  const sourceErrors = collectDerivativesSourceErrors(
    engineInput.market,
    engineInput.liquidation,
    resolvedOverrides,
  );

  if (engineInput.optionCandidates.length === 0) {
    sourceErrors.push({
      source: "Bybit Options",
      message: "No option candidates returned from chain.",
    });
  }

  if (engineInput.market.spotPrice <= 0) {
    sourceErrors.push({
      source: "Bybit Ticker",
      message: "BTC spot price unavailable or zero.",
    });
  }

  const output = runDecisionEngine(engineInput);
  const response = buildAnalyzeApiResponse(output, sourceErrors);
  return attachTradingDesk(
    engineInput,
    response,
    deskMemory,
    ethQuote,
    strategyRegistry,
    governance,
    adaptiveWeighting,
    advisoryStrategySignals,
    secondBrain,
  );
}

/** Map 6-step output to legacy AnalysisResult for dashboard components. */
export function toAnalysisResult(output: DecisionEngineOutput): AnalysisResult {
  return {
    market: output.step1_marketSnapshot,
    technical: output.technical.daily,
    verdict: {
      recommendation: output.step5_verdict.recommendation,
      confidence: output.step5_verdict.confidence,
      summary: output.step5_verdict.summary,
      checks: output.step2_eightCheckFramework,
      noTradeRules: output.step3_noTradeRules,
      combinationRead: output.step4_combinationRead,
      candidate: output.step5_verdict.candidate,
      risks: output.step5_verdict.risks,
      analyzedAt: output.step5_verdict.analyzedAt,
    },
    actionPlan: output.step6_actionPlan,
  };
}

/**
 * Runs decision engine with live/mock fetched data.
 * Returns structured 6-step JSON plus data-source errors.
 */
export async function runAnalysisEngine(
  overrides: Partial<DecisionEngineInput> & AnalysisInput = {},
): Promise<AnalyzeApiResponse> {
  const deskMemory = overrides.deskMemory;
  const ethQuote = overrides.ethQuote ?? null;
  const strategyRegistry = overrides.strategyRegistry ?? null;
  const governance = overrides.governance ?? null;
  const adaptiveWeighting = overrides.adaptiveWeighting ?? null;
  const advisoryStrategySignals = overrides.advisoryStrategySignals ?? [];
  const secondBrain =
    (overrides as { secondBrain?: SecondBrainCycleSnapshot }).secondBrain ?? null;
  const { input, sourceErrors } = await buildEngineInput(overrides);
  const output = runDecisionEngine(input);
  const base = buildAnalyzeApiResponse(output, sourceErrors);
  const response = attachTradingDesk(
    input,
    base,
    deskMemory,
    ethQuote,
    strategyRegistry,
    governance,
    adaptiveWeighting,
    advisoryStrategySignals,
    secondBrain,
  );

  if (isBybitCriticalFailure(response.marketSnapshot, response.dataSourceIssues)) {
    const issues = [
      { source: "Bybit API", message: BYBIT_API_FAILED_MESSAGE },
      ...response.dataSourceIssues,
    ];
    return attachTradingDesk(
      input,
      {
        ...response,
        sourceErrors: issues,
        dataSourceIssues: issues,
      },
      deskMemory,
      ethQuote,
      strategyRegistry,
      governance,
      adaptiveWeighting,
      advisoryStrategySignals,
      secondBrain,
    );
  }

  return response;
}

export {
  isBybitCriticalFailure,
  BYBIT_API_FAILED_MESSAGE,
} from "./bybit-health";

/**
 * @deprecated Use runAnalysisEngine for full 6-step output.
 */
export async function runAnalysis(
  input: AnalysisInput = {},
): Promise<AnalysisResult> {
  const result = await runAnalysisEngine(input);
  return toAnalysisResult(result);
}

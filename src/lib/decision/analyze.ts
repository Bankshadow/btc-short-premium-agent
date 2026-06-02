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
  DerivativesOverrides,
  LiquidationData,
  MacroEventStatus,
} from "@/lib/types/market";
import { applyDerivativesOverrides } from "./apply-overrides";
import { buildAnalyzeApiResponse } from "./analyze-response";
import { runDecisionEngine } from "./engine";

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

async function buildEngineInput(
  overrides: Partial<DecisionEngineInput> & AnalysisInput = {},
): Promise<{ input: DecisionEngineInput; sourceErrors: DataSourceError[] }> {
  const sourceErrors: DataSourceError[] = [];

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
    overrides.derivativesOverrides,
  );
  liquidation = mergedLiquidation;

  const dailyCandles = klineToCandle(dailyKlines);
  const h4Candles = klineToCandle(h4Klines);
  const h1Candles = klineToCandle(h1Klines);

  const symbol = market.symbol;

  const hasManualLiq = hasManualLiquidation(overrides.derivativesOverrides);

  if (hasManualLiq) {
    sourceErrors.push({
      source: "Liquidation",
      message: "Liquidation data is manually provided.",
    });
  } else if (liquidation.liquidation24h === null) {
    sourceErrors.push({
      source: "Liquidation",
      message:
        "Liquidation data unavailable — enter liquidation24h in Manual Overrides.",
    });
  }

  const missingOi = [
    market.oiChange24hPct === null && "oi24hChange",
    market.oiChange1hPct === null && "oi1hChange",
  ].filter(Boolean) as string[];

  if (missingOi.length > 0) {
    sourceErrors.push({
      source: "Open Interest",
      message: `Combination Read is partial because OI data is missing (${missingOi.join(", ")}).`,
    });
  }

  if (market.volumeChange24hPct === null) {
    sourceErrors.push({
      source: "Volume",
      message:
        "Combination Read is partial because volume24hChange is missing.",
    });
  }

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
    },
    sourceErrors,
  };
}

function hasManualLiquidation(overrides?: DerivativesOverrides): boolean {
  return overrides?.liquidation24h != null;
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
  const { input, sourceErrors } = await buildEngineInput(overrides);
  const output = runDecisionEngine(input);
  return buildAnalyzeApiResponse(output, sourceErrors);
}

/**
 * @deprecated Use runAnalysisEngine for full 6-step output.
 */
export async function runAnalysis(
  input: AnalysisInput = {},
): Promise<AnalysisResult> {
  const result = await runAnalysisEngine(input);
  return toAnalysisResult(result);
}

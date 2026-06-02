import { runDecisionEngine } from "@/lib/decision/engine";
import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
  OptionCandidate,
  TechnicalSnapshot,
} from "@/lib/types/market";

const MOCK_TIMESTAMP = "2025-06-02T08:00:00.000Z";

const mockCandidate: OptionCandidate = {
  symbol: "BTC-3JUN25-98000-C",
  strike: 98_000,
  expiry: "3JUN25",
  optionType: "call",
  markPrice: 420,
  bid: 410,
  ask: 430,
  impliedVolatility: 52,
  delta: 0.14,
  theta: -85,
  premiumUsd: 420,
  annualizedYieldPct: 38,
  otmPct: 2.1,
  sdDistance: 1.8,
};

function buildTechnicalSnapshot(
  symbol: string,
  trend: TechnicalSnapshot["trend"],
  resistance: number,
  support: number,
): TechnicalSnapshot {
  return {
    symbol,
    timestamp: MOCK_TIMESTAMP,
    rsi14: 48,
    ema20: 96_200,
    ema50: 95_400,
    ema200: 92_800,
    trend,
    macdHistogram: -120,
    support,
    resistance,
    atr4h: 800,
  };
}

function buildMockEngineInput(): DecisionEngineInput {
  return {
    market: {
      symbol: "BTCUSDT",
      spotPrice: 95_800,
      timestamp: MOCK_TIMESTAMP,
      hv30: 45,
      iv: 52,
      ivHvRatio: 1.16,
      ivRank: 55,
      ivPercentile: 58,
      fundingRate: 0.00005,
      openInterestBtc: 185_000,
      oiChange24hPct: 1.2,
      oiChange1hPct: 0.3,
      volume24hBtc: 42_000,
      volumeChange24hPct: 15,
      priceChange24hPct: -0.8,
    },
    optionCandidates: [mockCandidate],
    technicalDaily: buildTechnicalSnapshot("BTCUSDT", "bearish", 97_000, 94_500),
    technical4h: buildTechnicalSnapshot("BTCUSDT", "bearish", 97_000, 94_500),
    technical1h: buildTechnicalSnapshot("BTCUSDT", "neutral", 96_800, 95_200),
    macroEvent: { hasEventBeforeSettlement: false },
    liquidation: { liquidation24h: 35_000_000, source: "mock" },
    macroView: "bearish",
  };
}

/** Static mock dashboard payload — no external API calls. */
export function getMockDashboardData(): AnalyzeApiResponse {
  const output = runDecisionEngine(buildMockEngineInput());

  return {
    ...output,
    sourceErrors: [
      {
        source: "Demo Mode",
        message: "Homepage uses mock data only.",
      },
    ],
  };
}

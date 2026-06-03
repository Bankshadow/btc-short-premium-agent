export type OptionType = "call" | "put";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

/** Playbook verdict: TRADE / SKIP / WAIT */
export type TradeRecommendation = "trade" | "skip" | "wait";

export type MacroView = "bearish" | "bullish" | "neutral";

export type CombinationPattern =
  | "bullish_accumulation"
  | "long_capitulation"
  | "new_shorts_piling"
  | "quiet_deleveraging"
  | "unclear"
  | "partial_data";

export type LiquidationRegime =
  | "safe"
  | "borderline"
  | "cascade"
  | "caution"
  | "unknown";

export type CombinationDataStatus = "complete" | "partial_data";

/** Hypothetical action for analysis output only — never executed */
export type HypotheticalAction = "sell_call" | "sell_put" | "no_trade";

export interface MarketSnapshot {
  symbol: string;
  spotPrice: number;
  timestamp: string;
  hv30: number;
  iv: number;
  ivHvRatio: number;
  ivRank: number;
  ivPercentile: number;
  fundingRate: number;
  openInterestBtc: number;
  oiChange24hPct: number | null;
  oiChange1hPct: number | null;
  volume24hBtc: number;
  volumeChange24hPct: number | null;
  priceChange24hPct: number | null;
}

/** Live spot quote from public market API (display only). */
export interface SpotQuote {
  symbol: string;
  price: number;
  priceChange24hPct: number;
  timestamp: string;
}

export interface LiveMarketResponse {
  btc: MarketSnapshot;
  eth: SpotQuote;
}

export interface LiquidationData {
  liquidation24h: number | null;
  source: "mock" | "manual" | "live";
}

/** Manual CoinGlass-style overrides from dashboard */
export interface DerivativesOverrides {
  liquidation24h?: number | null;
  oi24hChange?: number | null;
  oi1hChange?: number | null;
  volume24hChange?: number | null;
}

export interface MacroEventStatus {
  hasEventBeforeSettlement: boolean;
  eventName?: string;
}

export interface OptionCandidate {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: OptionType;
  markPrice: number;
  bid: number;
  ask: number;
  impliedVolatility: number;
  delta: number;
  theta: number;
  premiumUsd: number;
  annualizedYieldPct: number;
  otmPct: number;
  sdDistance: number;
}

export interface TechnicalSnapshot {
  symbol: string;
  timestamp: string;
  rsi14: number;
  ema20: number;
  ema50: number;
  ema200: number;
  trend: "bullish" | "bearish" | "neutral";
  macdHistogram: number;
  support: number;
  resistance: number;
  atr4h: number;
}

export interface CheckResult {
  id: string;
  name: string;
  category:
    | "macro"
    | "market"
    | "technical"
    | "premium"
    | "risk"
    | "combination";
  status: CheckStatus;
  message: string;
  weight: number;
}

export interface NoTradeRuleResult {
  id: string;
  name: string;
  triggered: boolean;
  severity: "hard" | "soft";
  message: string;
}

export interface CombinationReadResult {
  pattern: CombinationPattern;
  label: string;
  actionHint: string;
  liquidationRegime: LiquidationRegime;
  dataStatus: CombinationDataStatus;
  missingFields: string[];
}

export interface VerdictOutput {
  recommendation: TradeRecommendation;
  confidence: number;
  summary: string;
  candidate?: OptionCandidate;
  risks: string[];
  caution: boolean;
  missingData: string[];
  analyzedAt: string;
}

export interface ActionPlan {
  action: HypotheticalAction;
  suggestedSizePct: number;
  entryNotes: string;
  exitNotes: string;
  slIndexPrice: number;
  slMethod: "index_price";
  pinExitTimeTh: string;
  settlementTimeTh: string;
  targetPremiumCapturePct: number;
  disclaimer: string;
}

/** Full decision engine input */
export interface DecisionEngineInput {
  market: MarketSnapshot;
  optionCandidates: OptionCandidate[];
  technicalDaily: TechnicalSnapshot;
  technical4h: TechnicalSnapshot;
  technical1h: TechnicalSnapshot;
  macroEvent: MacroEventStatus;
  liquidation: LiquidationData;
  macroView?: MacroView;
  consecutiveLosses?: number;
  priorDayRallyPct?: number;
  derivativesOverrides?: DerivativesOverrides;
}

/** Structured 6-step JSON output */
export interface DecisionEngineOutput {
  step1_marketSnapshot: MarketSnapshot;
  step2_eightCheckFramework: CheckResult[];
  step3_noTradeRules: NoTradeRuleResult[];
  step4_combinationRead: CombinationReadResult;
  step5_verdict: VerdictOutput;
  step6_actionPlan: ActionPlan;
  optionCandidates: OptionCandidate[];
  technical: {
    daily: TechnicalSnapshot;
    h4: TechnicalSnapshot;
    h1: TechnicalSnapshot;
  };
  liquidation: LiquidationData;
  macroEvent: MacroEventStatus;
}

export interface DataSourceError {
  source: string;
  message: string;
}

export interface AnalyzeApiResponse extends DecisionEngineOutput {
  sourceErrors: DataSourceError[];
  /** Friendly alias for step1_marketSnapshot */
  marketSnapshot: MarketSnapshot;
  /** Friendly alias for technical (daily / 4h / 1h) */
  technicalSnapshot: DecisionEngineOutput["technical"];
  /** Friendly alias for step2_eightCheckFramework */
  checks: CheckResult[];
  /** Friendly alias for step3_noTradeRules */
  noTradeRules: NoTradeRuleResult[];
  /** Friendly alias for step4_combinationRead */
  combinationRead: CombinationReadResult;
  /** Friendly alias for step5_verdict */
  verdict: VerdictOutput;
  /** Friendly alias for step6_actionPlan */
  actionPlan: ActionPlan;
  /** ISO timestamp of when analysis completed */
  dataTimestamp: string;
  /** Friendly alias for sourceErrors */
  dataSourceIssues: DataSourceError[];
}

/** @deprecated Use DecisionEngineInput */
export interface AnalysisInput {
  macroView?: MacroView;
  macroEventToday?: boolean;
  macroEvent?: MacroEventStatus;
  consecutiveLosses?: number;
  priorDayRallyPct?: number;
  derivativesOverrides?: DerivativesOverrides;
}

/** @deprecated Use DecisionEngineOutput — kept for dashboard compatibility */
export interface AnalysisResult {
  market: MarketSnapshot;
  technical: TechnicalSnapshot;
  verdict: {
    recommendation: TradeRecommendation;
    confidence: number;
    summary: string;
    checks: CheckResult[];
    noTradeRules: NoTradeRuleResult[];
    combinationRead: CombinationReadResult;
    candidate?: OptionCandidate;
    risks: string[];
    analyzedAt: string;
  };
  actionPlan: ActionPlan;
}

export interface TradeVerdict {
  recommendation: TradeRecommendation;
  confidence: number;
  summary: string;
  checks: CheckResult[];
  noTradeRules: NoTradeRuleResult[];
  combinationRead: CombinationReadResult;
  candidate?: OptionCandidate;
  risks: string[];
  analyzedAt: string;
}

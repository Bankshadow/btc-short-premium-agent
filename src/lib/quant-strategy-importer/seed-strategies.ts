import type { StrategySource, SuggestedUse } from "./types";
import { QUANT_SOURCE_BASE_URL, QUANT_SOURCE_REPO } from "./types";

export interface StrategySeedDefinition extends StrategySource {
  thesis: string;
  marketRegimeFit: string[];
  cryptoAdaptationNotes: string[];
  requiredData: string[];
  riskWarning: string;
  suggestedUse: SuggestedUse;
}

function repoPath(folder: string): string {
  return `${QUANT_SOURCE_BASE_URL}/tree/master/${folder}`;
}

export const QUANT_CATALOG_IMPORTED_AT = "2026-06-06T12:00:00.000Z";

export const QUANT_STRATEGY_SEEDS: StrategySeedDefinition[] = [
  {
    sourceId: "macd-oscillator",
    sourceUrl: repoPath("MACD Oscillator"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "MACD Oscillator",
    category: "Momentum / Trend",
    description:
      "Uses MACD line vs signal crossovers and histogram momentum to time entries and exits on trending instruments.",
    originalAssumptions: [
      "Trend persistence after MACD crossover",
      "Daily or 4H bars with stable liquidity",
      "Low transaction costs relative to move size",
    ],
    riskNotes: [
      "Whipsaws in ranging markets",
      "Lagging indicator — late entries on fast reversals",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Trade BTC/SOL perp momentum when MACD histogram expands in the direction of the 4H trend, using signal-line crosses as timing confirmation.",
    marketRegimeFit: ["bull_trend", "bear_trend", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Use 4H + daily BTCUSDT/SOLUSDT klines; widen signal thresholds during high funding regimes.",
      "Pair with funding/OI filter — avoid counter-trend MACD longs when funding is extreme positive.",
      "24/7 crypto sessions remove equity open/close effects; ignore cash-session assumptions.",
    ],
    requiredData: ["4H klines", "Daily klines", "Funding rate", "OI change"],
    riskWarning:
      "MACD crossovers fail in tight ranges; do not wire to autopilot without backtest on 2022–2024 crypto chop.",
    suggestedUse: "ENTRY",
  },
  {
    sourceId: "rsi-pattern-recognition",
    sourceUrl: repoPath("RSI Pattern Recognition"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "RSI Pattern Recognition",
    category: "Mean Reversion / Pattern",
    description:
      "Detects RSI-based chart patterns (divergence, failure swings, support/resistance zones) for reversal timing.",
    originalAssumptions: [
      "RSI extremes reflect exhausted momentum",
      "Pattern geometry repeats across liquid markets",
      "Mean reversion within bounded ranges",
    ],
    riskNotes: [
      "Trending markets invalidate oversold/overbought fades",
      "Pattern labeling is subjective without strict rules",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Identify BTC/SOL exhaustion via RSI(14) divergence on 4H, only when regime brain flags range or post-cascade stabilization.",
    marketRegimeFit: ["quiet_range", "post_cascade", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Crypto RSI can stay overbought longer in bull legs — use dynamic bands (e.g. 40/60 in trends, 30/70 in ranges).",
      "SOL beta amplifies false positives; require BTC confirmation for SOL entries.",
      "Combine with liquidation spike context from desk derivatives overrides.",
    ],
    requiredData: ["4H RSI", "Daily RSI", "Liquidation 24h", "Regime label"],
    riskWarning:
      "Pattern recognition overfits easily; keep as filter layer, not standalone autopilot trigger.",
    suggestedUse: "FILTER",
  },
  {
    sourceId: "bollinger-bands-pattern",
    sourceUrl: repoPath("Bollinger Bands Pattern Recognition"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Bollinger Bands Pattern Recognition",
    category: "Volatility / Mean Reversion",
    description:
      "Recognizes Bollinger Band squeeze, expansion, and walk-the-band patterns for breakout or fade setups.",
    originalAssumptions: [
      "Volatility clusters then mean-reverts or breaks out",
      "20-period SMA is a fair anchor for short-term price",
      "Band touches indicate statistical extremes",
    ],
    riskNotes: [
      "Squeeze breakouts can false-start in low-liquidity alts",
      "Band walks in strong trends punish mean-reversion entries",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Use BB(20,2) squeeze on BTC daily to flag imminent volatility expansion; directional bias from desk committee, not band touch alone.",
    marketRegimeFit: ["quiet_range", "bull_trend", "bear_trend"],
    cryptoAdaptationNotes: [
      "Weekend liquidity drops widen bands artificially — exclude or down-weight Sat/Sun signals.",
      "On SOL, use wider bands (2.5σ) or longer window to reduce noise.",
      "Funding spikes often precede band expansion — log as confluence, not sole trigger.",
    ],
    requiredData: ["Daily OHLCV", "BB width percentile", "Funding rate"],
    riskWarning:
      "Do not short BTC solely on upper band touch in bull regimes; treat as research filter only.",
    suggestedUse: "FILTER",
  },
  {
    sourceId: "dual-thrust",
    sourceUrl: repoPath("Dual Thrust"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Dual Thrust",
    category: "Breakout / Range",
    description:
      "Opening-range breakout system using prior period high/low range to set upper/lower thrust lines for intraday entries.",
    originalAssumptions: [
      "Defined session open with meaningful range",
      "Breakouts beyond range carry follow-through",
      "Fixed lookback for range calculation",
    ],
    riskNotes: [
      "False breakouts around macro events",
      "Sensitive to lookback window choice",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Adapt Dual Thrust to crypto by using rolling 24h UTC range on BTC/SOL perps; breakout entries only when OI confirms.",
    marketRegimeFit: ["bull_trend", "bear_trend", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Replace equity session open with UTC 00:00 or 13:30 US macro window for range anchor.",
      "24/7 market means multiple pseudo-sessions — test 4H and 8H range variants.",
      "Use thrust lines as alert levels for desk, not market orders without slippage model.",
    ],
    requiredData: ["Intraday klines", "24h high/low", "OI 1h change", "Volume"],
    riskWarning:
      "Breakout systems suffer in chop; requires kill-switch when ADX/regime is range-bound.",
    suggestedUse: "ENTRY",
  },
  {
    sourceId: "heikin-ashi",
    sourceUrl: repoPath("Heikin-Ashi"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Heikin-Ashi",
    category: "Trend Smoothing",
    description:
      "Transforms OHLC into Heikin-Ashi candles to filter noise and identify trend continuation via consecutive same-color bars.",
    originalAssumptions: [
      "Smoothed candles reduce false reversals",
      "Consecutive HA colors indicate trend health",
      "Lag acceptable for swing holds",
    ],
    riskNotes: [
      "Delayed exits in sharp reversals",
      "HA levels differ from real price for stops",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Use Heikin-Ashi color flips on BTC 4H as exit timing for short-premium and perp directional overlays — entry still desk-gated.",
    marketRegimeFit: ["bull_trend", "bear_trend"],
    cryptoAdaptationNotes: [
      "Stops must use real OHLC, not HA prices — critical on high-vol SOL moves.",
      "Combine with ATR trailing stop for crypto gap risk (exchange outages, wicks).",
      "Works better as EXIT layer for existing positions than cold ENTRY signal.",
    ],
    requiredData: ["4H OHLC", "ATR", "Real vs HA close spread"],
    riskWarning:
      "HA-smoothed entries lag fast crypto reversals; never map directly to Binance autopilot.",
    suggestedUse: "EXIT",
  },
  {
    sourceId: "london-breakout",
    sourceUrl: repoPath("London Breakout"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "London Breakout",
    category: "Session Breakout",
    description:
      "Trades breakouts of the Asian session range during the London open window when liquidity and volatility expand.",
    originalAssumptions: [
      "Distinct Asia/London session ranges",
      "London open drives directional flow",
      "FX-style session clock",
    ],
    riskNotes: [
      "Session definitions weak in 24/7 crypto",
      "Macro prints can invalidate range breaks",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Re-map London Breakout to 'Asia range (00:00–08:00 UTC) break during US/EU overlap' for BTC perp momentum scalps.",
    marketRegimeFit: ["bull_trend", "bear_trend", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Crypto has no true London close — use UTC windows and test US open (13:30 UTC) as alternate trigger.",
      "BTC leads; SOL breakouts should require BTC same-direction confirmation.",
      "Avoid breakout trades 30m before FOMC/CPI per desk macro event flag.",
    ],
    requiredData: ["1H klines", "Session range boxes", "Macro calendar", "BTC dominance"],
    riskWarning:
      "Session breakout edge may not survive 24/7 crypto microstructure; backtest before paper.",
    suggestedUse: "ENTRY",
  },
  {
    sourceId: "parabolic-sar",
    sourceUrl: repoPath("Parabolic SAR"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Parabolic SAR",
    category: "Trend Following",
    description:
      "Parabolic Stop-and-Reverse dots track trend direction; flips signal potential reversals or trailing stop placement.",
    originalAssumptions: [
      "Trends persist long enough for SAR trail",
      "AF/step parameters stable across assets",
      "Whipsaw acceptable with position sizing",
    ],
    riskNotes: [
      "Frequent flips in sideways markets",
      "Poor performance during volatility compression",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Use SAR on BTC daily as trailing stop reference for perp positions; SAR flip alone is insufficient for desk TRADE verdict.",
    marketRegimeFit: ["bull_trend", "bear_trend"],
    cryptoAdaptationNotes: [
      "Increase SAR AF increment on SOL to reduce flip frequency.",
      "Use SAR as RISK_GATE veto when flip opposes open short-premium thesis.",
      "Weekend wicks trigger false SAR flips — optional weekend freeze.",
    ],
    requiredData: ["Daily OHLC", "SAR series", "ATR regime"],
    riskWarning:
      "SAR is a lagging trail; pairing with autopilot without sizing rules risks overtrading.",
    suggestedUse: "RISK_GATE",
  },
  {
    sourceId: "pair-trading",
    sourceUrl: repoPath("Pair Trading"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Pair Trading",
    category: "Statistical Arbitrage",
    description:
      "Trades mean reversion of a spread between two correlated assets using z-score or cointegration signals.",
    originalAssumptions: [
      "Stable correlation/cointegration between pair",
      "Spread mean-reverts faster than single-leg risk",
      "Market-neutral PnL target",
    ],
    riskNotes: [
      "Correlation breakdown during regime shifts",
      "Dual-leg execution and margin complexity",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Evaluate BTC–ETH and BTC–SOL spread z-scores as portfolio overlay; paper-only pairs, not single-leg autopilot.",
    marketRegimeFit: ["quiet_range", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Crypto correlations spike in crashes — cointegration unstable; re-estimate weekly.",
      "Use perp funding differentials as extra filter (avoid paying double funding).",
      "Desk already tracks ethQuote — align pair signals with existing regime brain.",
    ],
    requiredData: ["BTC/ETH/SOL prices", "Spread z-score", "Rolling correlation", "Funding both legs"],
    riskWarning:
      "Pair trades need two-leg execution not supported by current Binance autopilot; RESEARCH_ONLY until infrastructure exists.",
    suggestedUse: "RESEARCH_ONLY",
  },
  {
    sourceId: "options-straddle",
    sourceUrl: repoPath("Options Straddle"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Options Straddle",
    category: "Volatility / Options",
    description:
      "Long or short straddle structures profit from realized volatility relative to implied vol before/after events.",
    originalAssumptions: [
      "Options chain with reliable IV",
      "Event-driven vol expansion or crush",
      "Defined expiry and greek management",
    ],
    riskNotes: [
      "Theta bleed on long straddles",
      "Short straddle tail risk in crypto crashes",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Map straddle logic to desk options_short_premium context: compare IV/HV on BTC Bybit options before event weeks.",
    marketRegimeFit: ["quiet_range", "post_cascade", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "BTC options liquidity OK on Bybit; SOL options thinner — prefer BTC for straddle research.",
      "Align with existing IV/HV ratio checks in options short premium strategy.",
      "Never auto-sell naked straddle legs on testnet without greek limits.",
    ],
    requiredData: ["Bybit option chain", "IV/HV", "Event calendar", "Skew"],
    riskWarning:
      "Short vol in crypto tails is catastrophic; keep straddle research separate from autonomous perp executor.",
    suggestedUse: "RESEARCH_ONLY",
  },
  {
    sourceId: "monte-carlo",
    sourceUrl: repoPath("Monte Carlo"),
    repoName: QUANT_SOURCE_REPO,
    strategyName: "Monte Carlo",
    category: "Risk Simulation",
    description:
      "Simulates many random price paths to estimate strategy survival, drawdown distribution, and tail risk.",
    originalAssumptions: [
      "Return distribution representative of future",
      "Independent trials (or modeled autocorrelation)",
      "Sufficient historical sample",
    ],
    riskNotes: [
      "Model risk if tails underestimated",
      "Crypto fat tails break Gaussian assumptions",
    ],
    importStatus: "RESEARCH_ONLY",
    thesis:
      "Stress-test BTC/SOL short-premium and perp directional sizing with Monte Carlo on historical returns — informs risk budget, not entries.",
    marketRegimeFit: ["bull_trend", "bear_trend", "quiet_range", "post_cascade", "mixed_unclear"],
    cryptoAdaptationNotes: [
      "Use fat-tailed or block-bootstrap resampling; Gaussian MC understates crash risk.",
      "Feed desk trust-scaled notional caps with MC 95th percentile drawdown.",
      "Run on combined paper + testnet journal returns, not synthetic equity data.",
    ],
    requiredData: ["Historical returns", "Trade journal", "Volatility regime labels"],
    riskWarning:
      "Simulation output is advisory; cannot promote to live sizing without human sign-off.",
    suggestedUse: "RISK_GATE",
  },
];

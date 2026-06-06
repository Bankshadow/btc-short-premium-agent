import type { TournamentContestantMeta } from "./types";

export const TOURNAMENT_CONTESTANTS: TournamentContestantMeta[] = [
  {
    sourceId: "macd-oscillator",
    strategyName: "MACD Oscillator",
    category: "Momentum",
    simplicity: 82,
    executionRisk: 72,
    suggestedRole: "ENTRY",
  },
  {
    sourceId: "rsi-pattern-recognition",
    strategyName: "RSI Pattern Recognition",
    category: "Mean Reversion",
    simplicity: 78,
    executionRisk: 68,
    suggestedRole: "FILTER",
  },
  {
    sourceId: "bollinger-bands-pattern",
    strategyName: "Bollinger Bands",
    category: "Volatility",
    simplicity: 75,
    executionRisk: 70,
    suggestedRole: "FILTER",
  },
  {
    sourceId: "dual-thrust",
    strategyName: "Dual Thrust",
    category: "Breakout",
    simplicity: 65,
    executionRisk: 55,
    suggestedRole: "ENTRY",
  },
  {
    sourceId: "heikin-ashi",
    strategyName: "Heikin-Ashi",
    category: "Trend Smoothing",
    simplicity: 80,
    executionRisk: 74,
    suggestedRole: "EXIT",
  },
  {
    sourceId: "ai-desk-options-premium",
    strategyName: "AI Desk (Options Short Premium)",
    category: "Desk Primary",
    simplicity: 45,
    executionRisk: 60,
    suggestedRole: "DESK_PRIMARY",
  },
];

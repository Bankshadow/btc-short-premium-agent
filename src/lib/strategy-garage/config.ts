import type { StrategyGarageStage } from "./types";

export const STRATEGY_GARAGE_STORE_FILE = "strategy-garage.json";
export const STRATEGY_GARAGE_BACKTEST_FILE = "strategy-garage-backtests.json";

export const GARAGE_NAV_LINKS = [
  { href: "/strategy-garage", label: "Garage", primary: true },
  { href: "/strategy-lab/imports", label: "Imports" },
  { href: "/strategy-lab/backtest", label: "Backtest" },
  { href: "/strategy-lab/shadow", label: "Shadow" },
  { href: "/strategy-lab/tournament", label: "Tournament" },
] as const;

export const GARAGE_STAGE_ORDER: StrategyGarageStage[] = [
  "IMPORTED",
  "AI_REVIEWED",
  "BACKTEST_READY",
  "SHADOW_TESTING",
  "TESTNET_READY",
  "APPROVED_FOR_USE",
  "REJECTED",
];

export function buildBacktestUrl(sourceId: string): string {
  return `/strategy-lab/backtest?importId=${encodeURIComponent(sourceId)}&source=garage`;
}

export function buildShadowUrl(sourceId: string): string {
  return `/strategy-lab/shadow?sourceId=${encodeURIComponent(sourceId)}`;
}

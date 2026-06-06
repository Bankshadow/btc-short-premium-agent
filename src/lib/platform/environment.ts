import type { TradingEnvironment } from "./types";

export const TRADING_ENVIRONMENT_LABELS: Record<TradingEnvironment, string> = {
  DEMO: "Demo",
  PAPER: "Paper",
  TESTNET: "Testnet",
  LIVE_LOCKED: "Live locked",
  LIVE_ENABLED: "Live enabled",
};

export const TRADING_ENVIRONMENT_ORDER: TradingEnvironment[] = [
  "DEMO",
  "PAPER",
  "TESTNET",
  "LIVE_LOCKED",
  "LIVE_ENABLED",
];

export function environmentBadgeClass(env: TradingEnvironment): string {
  if (env === "LIVE_ENABLED") return "text-rose-300 bg-rose-950/50 ring-rose-800/50";
  if (env === "TESTNET") return "text-cyan-300 bg-cyan-950/50 ring-cyan-800/50";
  if (env === "PAPER") return "text-emerald-300 bg-emerald-950/50 ring-emerald-800/50";
  if (env === "DEMO") return "text-amber-300 bg-amber-950/50 ring-amber-800/50";
  return "text-zinc-400 bg-zinc-900/60 ring-zinc-700/50";
}

export function isLiveEnvironment(env: TradingEnvironment): boolean {
  return env === "LIVE_ENABLED";
}

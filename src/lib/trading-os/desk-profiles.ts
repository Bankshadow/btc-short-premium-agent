import type { DeskProfile } from "./trading-os-types";

export const DESK_PROFILES: DeskProfile[] = [
  {
    id: "btc_options_desk",
    name: "BTC Options Desk",
    tagline: "Short premium playbook · Bybit chain · committee TRADE path",
    defaultRiskProfile: "balanced",
    defaultEnvironmentMode: "SEMI_LIVE",
    symbolFocus: "BTCUSDT options",
    features: ["8-check framework", "Options strategy agent", "Macro gate"],
  },
  {
    id: "crypto_multi_agent",
    name: "Crypto Multi-Agent Desk",
    tagline: "Bull/bear thesis · spot · futures · options committee",
    defaultRiskProfile: "balanced",
    defaultEnvironmentMode: "PAPER",
    symbolFocus: "BTC + ETH correlation",
    features: ["Research layer", "Regime router", "Desk memory"],
  },
  {
    id: "paper_trading_lab",
    name: "Paper Trading Lab",
    tagline: "Paper book only · learning and journal sync",
    defaultRiskProfile: "balanced",
    defaultEnvironmentMode: "PAPER",
    symbolFocus: "Hypothetical % PnL",
    features: ["Auto paper on TRADE", "Outcome resolution", "Scoreboard"],
  },
  {
    id: "aggressive_growth_lab",
    name: "Aggressive Growth Lab",
    tagline: "Higher TRADE tolerance · validation watch — still no live orders",
    defaultRiskProfile: "aggressive",
    defaultEnvironmentMode: "SEMI_LIVE",
    symbolFocus: "BTC short premium",
    features: ["Aggressive risk profile", "Capital milestones", "Strategy registry"],
  },
];

export function getDeskProfile(id: string): DeskProfile {
  return DESK_PROFILES.find((p) => p.id === id) ?? DESK_PROFILES[0];
}

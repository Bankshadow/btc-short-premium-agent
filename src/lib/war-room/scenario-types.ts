export type WarRoomScenarioId =
  | "btc_dump_8pct"
  | "liquidation_800m"
  | "funding_flip_negative"
  | "bybit_api_stale"
  | "cpi_2h"
  | "telegram_alert_failure"
  | "supabase_sync_failure"
  | "aggressive_drawdown"
  | "risk_veto_ignored"
  | "eth_btc_divergence";

export interface WarRoomScenarioDefinition {
  id: WarRoomScenarioId;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export const WAR_ROOM_SCENARIOS: WarRoomScenarioDefinition[] = [
  {
    id: "btc_dump_8pct",
    title: "BTC dumps 8% in 1 hour",
    description: "Fast risk-off move through short-premium strikes.",
    severity: "critical",
  },
  {
    id: "liquidation_800m",
    title: "Liquidation exceeds $800M",
    description: "Cascade zone — hard no-trade territory.",
    severity: "critical",
  },
  {
    id: "funding_flip_negative",
    title: "Funding flips negative",
    description: "Short squeeze risk on futures sleeve.",
    severity: "high",
  },
  {
    id: "bybit_api_stale",
    title: "Bybit API stale",
    description: "Data trust CRITICAL — no TRADE.",
    severity: "high",
  },
  {
    id: "cpi_2h",
    title: "CPI in 2 hours",
    description: "Macro event before settlement.",
    severity: "medium",
  },
  {
    id: "telegram_alert_failure",
    title: "Telegram alert failure",
    description: "Ops notification path down.",
    severity: "medium",
  },
  {
    id: "supabase_sync_failure",
    title: "Supabase sync failure",
    description: "Journal sync degraded — local log authoritative.",
    severity: "low",
  },
  {
    id: "aggressive_drawdown",
    title: "Aggressive mode drawdown",
    description: "Profile drawdown breach on paper book.",
    severity: "high",
  },
  {
    id: "risk_veto_ignored",
    title: "Risk Manager veto ignored",
    description: "Operator override bypass scenario.",
    severity: "critical",
  },
  {
    id: "eth_btc_divergence",
    title: "ETH/BTC divergence spike",
    description: "Correlation breakdown — regime uncertain.",
    severity: "medium",
  },
];

export interface WarRoomDrillResult {
  scenarioId: WarRoomScenarioId;
  title: string;
  emergencyAction: string;
  strategiesToDisable: string[];
  enableSafeMode: boolean;
  alertsToSend: string[];
  operatorChecklist: string[];
  committeeRecommendation: "TRADE" | "WAIT" | "SKIP";
  riskManagerVeto: boolean;
  conflictLevel: string;
  dataTrustGrade: string;
  frequencyAllowed: boolean;
  playbookActions: string[];
}

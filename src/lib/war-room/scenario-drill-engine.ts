import type { WarRoomScenarioId, WarRoomDrillResult } from "./scenario-types";
import { WAR_ROOM_SCENARIOS } from "./scenario-types";
import { checkTradeFrequency } from "@/lib/frequency/trade-frequency-governor";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

export function runScenarioDrill(input: {
  scenarioId: WarRoomScenarioId;
  entries?: DecisionLogEntry[];
}): WarRoomDrillResult {
  const def = WAR_ROOM_SCENARIOS.find((s) => s.id === input.scenarioId);
  const title = def?.title ?? input.scenarioId;
  const entries = input.entries ?? [];

  const base = {
    scenarioId: input.scenarioId,
    title,
    strategiesToDisable: [] as string[],
    enableSafeMode: false,
    alertsToSend: [] as string[],
    operatorChecklist: [] as string[],
    committeeRecommendation: "WAIT" as const,
    riskManagerVeto: false,
    conflictLevel: "MEDIUM",
    dataTrustGrade: "MEDIUM",
    frequencyAllowed: true,
    playbookActions: [] as string[],
  };

  const freq = checkTradeFrequency({ entries });

  switch (input.scenarioId) {
    case "btc_dump_8pct":
      return {
        ...base,
        emergencyAction: "SKIP all short premium — reduce size to 0; mark hypothetical stops.",
        strategiesToDisable: ["OPTIONS", "FUTURES"],
        enableSafeMode: true,
        alertsToSend: ["Desk alert: BTC -8% — safe mode recommended"],
        operatorChecklist: [
          "Confirm SL on open paper positions",
          "Disable aggressive profile",
          "Re-run analyze after vol settles",
        ],
        committeeRecommendation: "SKIP",
        riskManagerVeto: true,
        conflictLevel: "CRITICAL",
        dataTrustGrade: "MEDIUM",
        frequencyAllowed: false,
        playbookActions: ["enable_safe_mode", "disable_aggressive", "pause_paper_auto_open"],
      };
    case "liquidation_800m":
      return {
        ...base,
        emergencyAction: "Hard no-trade — liquidation cascade playbook.",
        strategiesToDisable: ["OPTIONS", "FUTURES", "SPOT"],
        enableSafeMode: true,
        alertsToSend: ["Liquidation > $800M — committee SKIP"],
        operatorChecklist: ["Verify CoinGlass override", "Wait for liq < $50M"],
        committeeRecommendation: "SKIP",
        riskManagerVeto: true,
        conflictLevel: "CRITICAL",
        dataTrustGrade: "LOW",
        frequencyAllowed: false,
        playbookActions: ["enable_safe_mode", "force_wait_skip", "create_incident"],
      };
    case "funding_flip_negative":
      return {
        ...base,
        emergencyAction: "Disable FUTURES long bias — favor WAIT on short premium.",
        strategiesToDisable: ["FUTURES"],
        alertsToSend: ["Funding negative — futures sleeve paused"],
        operatorChecklist: ["Check funding on tape", "Review bull/bear thesis"],
        committeeRecommendation: "WAIT",
        riskManagerVeto: false,
        conflictLevel: "HIGH",
        playbookActions: ["disable_aggressive"],
      };
    case "bybit_api_stale":
      return {
        ...base,
        emergencyAction: "Data trust CRITICAL — no TRADE until fresh tape.",
        enableSafeMode: true,
        alertsToSend: ["Market data stale — analysis paused"],
        operatorChecklist: ["Manual overrides only", "Do not approve tickets"],
        committeeRecommendation: "WAIT",
        dataTrustGrade: "CRITICAL",
        conflictLevel: "HIGH",
        frequencyAllowed: false,
        playbookActions: ["force_wait_skip", "require_manual_review"],
      };
    case "cpi_2h":
      return {
        ...base,
        emergencyAction: "Macro hold — WAIT unless aggressive profile explicitly off.",
        operatorChecklist: ["Macro calendar confirm", "Reduce size if trading"],
        committeeRecommendation: "WAIT",
        conflictLevel: "MEDIUM",
        playbookActions: ["require_manual_review"],
      };
    case "telegram_alert_failure":
      return {
        ...base,
        emergencyAction: "Ops: switch to manual desk checks — alerts paused optional.",
        alertsToSend: [],
        operatorChecklist: ["Check webhook config", "Use desk narrator locally"],
        committeeRecommendation: "WAIT",
        playbookActions: ["pause_alerts"],
      };
    case "supabase_sync_failure":
      return {
        ...base,
        emergencyAction: "Local journal authoritative — avoid multi-device edits.",
        operatorChecklist: ["Export decision log backup", "Retry sync later"],
        committeeRecommendation: "WAIT",
        dataTrustGrade: "MEDIUM",
        playbookActions: [],
      };
    case "aggressive_drawdown":
      return {
        ...base,
        emergencyAction: "Disable aggressive — revert balanced until drawdown recovers.",
        enableSafeMode: true,
        strategiesToDisable: ["OPTIONS"],
        committeeRecommendation: "SKIP",
        riskManagerVeto: true,
        playbookActions: ["disable_aggressive", "enable_safe_mode", "pause_paper_auto_open"],
      };
    case "risk_veto_ignored":
      return {
        ...base,
        emergencyAction: "Operator override audit — incident required.",
        enableSafeMode: true,
        committeeRecommendation: "SKIP",
        riskManagerVeto: true,
        conflictLevel: "CRITICAL",
        operatorChecklist: [
          "Review override log",
          "No semi-live tickets until signed off",
        ],
        playbookActions: ["create_incident", "require_manual_review", "enable_safe_mode"],
      };
    case "eth_btc_divergence":
      return {
        ...base,
        emergencyAction: "Regime uncertain — paper only, reduced size.",
        operatorChecklist: ["ETH/BTC correlation panel", "Favor WAIT on TRADE"],
        committeeRecommendation: "WAIT",
        conflictLevel: "MEDIUM",
        playbookActions: ["disable_aggressive"],
      };
    default:
      return {
        ...base,
        emergencyAction: "Run full desk analyze with caution.",
        frequencyAllowed: freq.frequencyAllowed,
      };
  }
}

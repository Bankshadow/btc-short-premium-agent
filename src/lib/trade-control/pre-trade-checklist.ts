import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { evaluateKillSwitch, loadKillSwitchState } from "@/lib/validation/kill-switch";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadTradeControlSettings } from "./trade-control-settings";
import type { OrderTicket, PreTradeChecklistResult } from "./trade-control-types";

export function runPreTradeChecklist(input: {
  data: AnalyzeApiResponse;
  ticket: OrderTicket;
  entries: DecisionLogEntry[];
}): PreTradeChecklistResult {
  const { data, ticket, entries } = input;
  const desk = data.tradingDesk;
  const settings = loadTradeControlSettings();
  const deskSettings = loadDeskSettings();
  const killSwitch = evaluateKillSwitch({
    entries,
    orders: loadPaperOrders(),
    riskProfile: deskSettings.riskProfile,
    latestAnalysis: data,
    persisted: loadKillSwitchState(),
  });

  const dqScore = desk?.research.dataQualityScore ?? 100;
  const missing = data.step5_verdict.missingData ?? [];
  const macroBlock = data.macroEvent.hasEventBeforeSettlement;
  const riskVeto = desk?.committee.riskVeto ?? false;
  const sizeOk = ticket.positionSizePct <= settings.maxPositionSizePct;

  const items = [
    {
      id: "data_quality",
      label: "Data quality OK",
      passed: dqScore >= 45 && missing.length === 0,
      detail:
        missing.length > 0
          ? `Missing: ${missing.join(", ")}`
          : `Quality ${dqScore}/100`,
    },
    {
      id: "risk_veto",
      label: "Risk veto not active",
      passed: !riskVeto && !(desk?.riskManager.veto ?? false),
      detail: riskVeto ? "Committee risk veto active" : "No veto",
    },
    {
      id: "daily_loss",
      label: "Daily loss limit",
      passed: !killSwitch.tradingPaused && killSwitch.dailyPnlPct > -3,
      detail: `Daily PnL ${killSwitch.dailyPnlPct}%`,
    },
    {
      id: "position_size",
      label: "Position size within profile",
      passed: sizeOk,
      detail: `${ticket.positionSizePct}% (max ${settings.maxPositionSizePct}%)`,
    },
    {
      id: "macro",
      label: "Macro event check",
      passed: !macroBlock,
      detail: macroBlock
        ? "High-impact event before settlement"
        : "No macro block",
    },
    {
      id: "required_data",
      label: "Required data present",
      passed:
        data.step1_marketSnapshot.spotPrice > 0 &&
        data.step1_marketSnapshot.ivHvRatio > 0,
      detail: `Spot ${data.step1_marketSnapshot.spotPrice > 0 ? "OK" : "missing"}`,
    },
    {
      id: "kill_switch",
      label: "Kill switch / cooldown",
      passed: !killSwitch.tradingPaused,
      detail: killSwitch.messages[0] ?? "Clear",
    },
  ];

  const allPassed = items.every((i) => i.passed);
  const failed = items.filter((i) => !i.passed);
  const blockedReason = allPassed
    ? null
    : failed.map((f) => f.label).join(", ");

  return { allPassed, items, blockedReason };
}

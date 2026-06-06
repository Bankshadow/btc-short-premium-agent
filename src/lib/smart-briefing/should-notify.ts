import { isBangkokQuietHours } from "@/lib/alerts/route-alert";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { EVENT_SEVERITY } from "./config";
import type { SmartBriefingEventType, SmartBriefingSettings } from "./types";

const PAPER_EVENTS: SmartBriefingEventType[] = [
  "PAPER_TRADE_OPENED",
  "SHADOW_TRADE_CREATED",
  "CLOSE_RECOMMENDED",
  "OUTCOME_RESOLVED",
];

const TRADE_EVENTS: SmartBriefingEventType[] = ["TRADE_CANDIDATE_FOUND"];

const SUMMARY_EVENTS: SmartBriefingEventType[] = ["DESK_CYCLE_COMPLETED"];

const WEEKLY_EVENTS: SmartBriefingEventType[] = ["LEARNING_MILESTONE_REACHED"];

const ALWAYS_SEND: SmartBriefingEventType[] = [
  "RISK_BLOCKER_TRIGGERED",
  "AUTOPILOT_ERROR",
  "ALERT_CHANNEL_DOWN",
];

export function shouldNotifyForEvent(
  eventType: SmartBriefingEventType,
  settings: SmartBriefingSettings,
  now = new Date(),
): { notify: boolean; reason: string | null } {
  const gov = loadGovernanceState();
  if (gov.disableAlerts && !ALWAYS_SEND.includes(eventType)) {
    return { notify: false, reason: "Alerts disabled by governance." };
  }

  const severity = EVENT_SEVERITY[eventType];

  if (settings.onlyCritical && severity !== "CRITICAL") {
    return { notify: false, reason: "Only critical alerts enabled." };
  }

  if (ALWAYS_SEND.includes(eventType)) {
    return { notify: true, reason: null };
  }

  if (TRADE_EVENTS.includes(eventType) && !settings.tradeCandidates) {
    return { notify: false, reason: "Trade candidate alerts off." };
  }

  if (PAPER_EVENTS.includes(eventType) && !settings.paperLifecycle) {
    return { notify: false, reason: "Paper lifecycle alerts off." };
  }

  if (SUMMARY_EVENTS.includes(eventType) && !settings.dailySummary) {
    return { notify: false, reason: "Daily summary off." };
  }

  if (WEEKLY_EVENTS.includes(eventType) && !settings.weeklyReport) {
    return { notify: false, reason: "Weekly report off." };
  }

  if (
    settings.quietHours &&
    isBangkokQuietHours(now) &&
    severity !== "CRITICAL"
  ) {
    return { notify: false, reason: "Quiet hours (Bangkok 22:00–08:00)." };
  }

  return { notify: true, reason: null };
}

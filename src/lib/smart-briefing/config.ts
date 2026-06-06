import type {
  DeskChannelLabel,
  NotificationSeverity,
  SmartBriefingEventType,
  SmartBriefingSettings,
  SmartBriefingType,
} from "./types";

export const SMART_BRIEFING_SETTINGS_KEY = "btc-desk:smart-briefing-settings";
export const SMART_NOTIFICATIONS_KEY = "btc-desk:smart-notifications";

export const SMART_BRIEFING_SAFETY_NOTICE =
  "Smart briefing is advisory only — alerts cannot approve actions or execute trades. No API secrets or live execution tokens are sent.";

export const MAX_NOTIFICATIONS = 200;

export const DEFAULT_SMART_BRIEFING_SETTINGS: SmartBriefingSettings = {
  onlyCritical: false,
  tradeCandidates: true,
  paperLifecycle: true,
  dailySummary: true,
  weeklyReport: true,
  quietHours: true,
};

export const EVENT_SEVERITY: Record<SmartBriefingEventType, NotificationSeverity> = {
  DESK_CYCLE_COMPLETED: "INFO",
  TRADE_CANDIDATE_FOUND: "WARNING",
  PAPER_TRADE_OPENED: "INFO",
  SHADOW_TRADE_CREATED: "INFO",
  CLOSE_RECOMMENDED: "WARNING",
  OUTCOME_RESOLVED: "INFO",
  RISK_BLOCKER_TRIGGERED: "CRITICAL",
  AUTOPILOT_ERROR: "CRITICAL",
  DATA_STALE: "WARNING",
  ALERT_CHANNEL_DOWN: "WARNING",
  LEARNING_MILESTONE_REACHED: "INFO",
  LIVE_READINESS_BLOCKED: "WARNING",
  LIVE_PILOT_EXECUTE: "CRITICAL",
  LIVE_PILOT_BLOCKED: "WARNING",
};

export const EVENT_BRIEFING_TYPE: Record<SmartBriefingEventType, SmartBriefingType> = {
  DESK_CYCLE_COMPLETED: "daily_briefing",
  TRADE_CANDIDATE_FOUND: "instant_alert",
  PAPER_TRADE_OPENED: "instant_alert",
  SHADOW_TRADE_CREATED: "instant_alert",
  CLOSE_RECOMMENDED: "instant_alert",
  OUTCOME_RESOLVED: "instant_alert",
  RISK_BLOCKER_TRIGGERED: "risk_escalation",
  AUTOPILOT_ERROR: "risk_escalation",
  DATA_STALE: "instant_alert",
  ALERT_CHANNEL_DOWN: "instant_alert",
  LEARNING_MILESTONE_REACHED: "weekly_learning_report",
  LIVE_READINESS_BLOCKED: "risk_escalation",
  LIVE_PILOT_EXECUTE: "instant_alert",
  LIVE_PILOT_BLOCKED: "risk_escalation",
};

export const EVENT_PAGE_LINK: Record<SmartBriefingEventType, string> = {
  DESK_CYCLE_COMPLETED: "/",
  TRADE_CANDIDATE_FOUND: "/",
  PAPER_TRADE_OPENED: "/portfolio",
  SHADOW_TRADE_CREATED: "/portfolio",
  CLOSE_RECOMMENDED: "/autopilot",
  OUTCOME_RESOLVED: "/",
  RISK_BLOCKER_TRIGGERED: "/command-center",
  AUTOPILOT_ERROR: "/autopilot",
  DATA_STALE: "/command-center",
  ALERT_CHANNEL_DOWN: "/notifications",
  LEARNING_MILESTONE_REACHED: "/validation",
  LIVE_READINESS_BLOCKED: "/live-readiness",
  LIVE_PILOT_EXECUTE: "/live-pilot",
  LIVE_PILOT_BLOCKED: "/live-pilot",
};

export const EVENT_TITLES: Record<SmartBriefingEventType, string> = {
  DESK_CYCLE_COMPLETED: "Desk cycle completed",
  TRADE_CANDIDATE_FOUND: "Trade candidate found",
  PAPER_TRADE_OPENED: "Paper trade opened",
  SHADOW_TRADE_CREATED: "Shadow trade created",
  CLOSE_RECOMMENDED: "Close recommended",
  OUTCOME_RESOLVED: "Outcome resolved",
  RISK_BLOCKER_TRIGGERED: "Risk blocker triggered",
  AUTOPILOT_ERROR: "Autopilot error",
  DATA_STALE: "Data stale",
  ALERT_CHANNEL_DOWN: "Alert channel down",
  LEARNING_MILESTONE_REACHED: "Learning milestone reached",
  LIVE_READINESS_BLOCKED: "Live readiness blocked",
  LIVE_PILOT_EXECUTE: "Live perp order executed",
  LIVE_PILOT_BLOCKED: "Live perp order blocked",
};

export const DESK_LABEL_FOR_EVENT: Partial<
  Record<SmartBriefingEventType, DeskChannelLabel>
> = {
  PAPER_TRADE_OPENED: "PAPER",
  SHADOW_TRADE_CREATED: "SHADOW",
  LIVE_READINESS_BLOCKED: "LIVE",
  LIVE_PILOT_EXECUTE: "LIVE",
  LIVE_PILOT_BLOCKED: "LIVE",
};

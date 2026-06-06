export type SmartBriefingEventType =
  | "DESK_CYCLE_COMPLETED"
  | "TRADE_CANDIDATE_FOUND"
  | "PAPER_TRADE_OPENED"
  | "SHADOW_TRADE_CREATED"
  | "CLOSE_RECOMMENDED"
  | "OUTCOME_RESOLVED"
  | "RISK_BLOCKER_TRIGGERED"
  | "AUTOPILOT_ERROR"
  | "DATA_STALE"
  | "ALERT_CHANNEL_DOWN"
  | "LEARNING_MILESTONE_REACHED"
  | "LIVE_READINESS_BLOCKED"
  | "LIVE_PILOT_EXECUTE"
  | "LIVE_PILOT_BLOCKED";

export type SmartBriefingType =
  | "instant_alert"
  | "daily_briefing"
  | "weekly_learning_report"
  | "risk_escalation"
  | "action_queue_summary";

export type DeskChannelLabel = "PAPER" | "SHADOW" | "TESTNET" | "LIVE" | "DESK";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationStatus = "UNREAD" | "READ" | "RESOLVED";

export interface SmartBriefingSettings {
  onlyCritical: boolean;
  tradeCandidates: boolean;
  paperLifecycle: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  quietHours: boolean;
}

export interface SmartBriefingPayload {
  eventType: SmartBriefingEventType;
  briefingType?: SmartBriefingType;
  severity?: NotificationSeverity;
  actionRequired?: boolean;
  deskLabel?: DeskChannelLabel;
  status?: string;
  verdict?: string | null;
  recommendedAction?: string | null;
  topReasons?: string[];
  blocker?: string | null;
  linkHref?: string;
  title?: string;
  body?: string;
}

export interface SmartNotification {
  id: string;
  eventType: SmartBriefingEventType;
  briefingType: SmartBriefingType;
  severity: NotificationSeverity;
  actionRequired: boolean;
  status: NotificationStatus;
  deskLabel: DeskChannelLabel;
  title: string;
  message: string;
  verdict: string | null;
  recommendedAction: string | null;
  topReasons: string[];
  blocker: string | null;
  linkHref: string;
  channelsAttempted: string[];
  channelsDelivered: string[];
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
}

export interface SmartBriefingDispatchResult {
  notification: SmartNotification;
  dispatched: boolean;
  skipped: boolean;
  skipReason: string | null;
  channelResults: Record<string, boolean | string>;
}

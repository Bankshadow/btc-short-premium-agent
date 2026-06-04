import type { GovernanceDeskState } from "@/lib/governance/governance-types";

export type EmergencyPlaybookActionId =
  | "enable_safe_mode"
  | "disable_aggressive"
  | "pause_paper_auto_open"
  | "pause_alerts"
  | "force_wait_skip"
  | "require_manual_review"
  | "create_incident";

export interface EmergencyPlaybookAction {
  id: EmergencyPlaybookActionId;
  label: string;
  description: string;
  /** Patches applied to governance state (analysis/paper only). */
  patch: Partial<GovernanceDeskState>;
  auditAction: string;
}

export const EMERGENCY_PLAYBOOK_ACTIONS: EmergencyPlaybookAction[] = [
  {
    id: "enable_safe_mode",
    label: "Enable Safe Mode",
    description: "Force WAIT/SKIP committee path; no semi-live tickets.",
    patch: { safeMode: true, disableAggressiveMode: true },
    auditAction: "war_room_safe_mode",
  },
  {
    id: "disable_aggressive",
    label: "Disable Aggressive Mode",
    description: "Desk reverts to balanced risk policy for analysis.",
    patch: { disableAggressiveMode: true },
    auditAction: "war_room_disable_aggressive",
  },
  {
    id: "pause_paper_auto_open",
    label: "Pause Paper Auto-Open",
    description: "Stop automatic paper orders on TRADE.",
    patch: { pausePaperAutoOpen: true },
    auditAction: "war_room_pause_paper",
  },
  {
    id: "pause_alerts",
    label: "Pause Alerts",
    description: "Silence webhooks until operator re-enables.",
    patch: { disableAlerts: true },
    auditAction: "war_room_pause_alerts",
  },
  {
    id: "force_wait_skip",
    label: "Force WAIT/SKIP only",
    description: "Pause analysis auto-refresh until cleared.",
    patch: { pauseAnalysis: true, safeMode: true },
    auditAction: "war_room_pause_analysis",
  },
  {
    id: "require_manual_review",
    label: "Require manual review",
    description: "Operator must acknowledge before next session.",
    patch: { operatorPaused: true, operatorPauseReason: "War room manual review" },
    auditAction: "war_room_manual_review",
  },
  {
    id: "create_incident",
    label: "Create incident",
    description: "Log governance incident for post-mortem.",
    patch: {},
    auditAction: "war_room_incident",
  },
];

export function getPlaybookAction(
  id: EmergencyPlaybookActionId,
): EmergencyPlaybookAction | undefined {
  return EMERGENCY_PLAYBOOK_ACTIONS.find((a) => a.id === id);
}

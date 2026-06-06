import type {
  CommandCenterActionRequest,
  CommandCenterActionResult,
  CommandCenterActionType,
  CommandCenterReport,
} from "./types";
import { COMMAND_CENTER_SAFETY_NOTICE } from "./types";
import { formatCommandCenterDailyReport } from "./export-daily-report";

const ALLOWED_ACTIONS: CommandCenterActionType[] = [
  "PAUSE_ANALYSIS",
  "PAUSE_PAPER_TRADING",
  "PAUSE_LIVE_PILOT",
  "TRIGGER_KILL_SWITCH",
  "REVIEW_PENDING_PROPOSAL",
  "OPEN_LIVE_SUPERVISOR",
  "OPEN_INCIDENT_REPORT",
  "EXPORT_DAILY_REPORT",
];

/** Actions that would increase risk — always rejected. */
const FORBIDDEN_ACTION_PATTERNS = [
  "RESUME",
  "ENABLE_LIVE",
  "APPROVE",
  "DISABLE_SAFE",
  "DISABLE_KILL",
  "INCREASE",
  "BYPASS",
] as const;

function isForbiddenAction(action: string): boolean {
  const upper = action.toUpperCase();
  return FORBIDDEN_ACTION_PATTERNS.some((p) => upper.includes(p));
}

export function runCommandCenterAction(
  request: CommandCenterActionRequest,
  report?: CommandCenterReport | null,
): CommandCenterActionResult {
  const note = request.operatorNote?.trim() ?? "";

  if (isForbiddenAction(request.action)) {
    return {
      ok: false,
      action: request.action,
      riskReducingOnly: true,
      clientMustPersist: false,
      message: "Action rejected — command center cannot increase risk.",
      error: COMMAND_CENTER_SAFETY_NOTICE,
    };
  }

  if (!ALLOWED_ACTIONS.includes(request.action)) {
    return {
      ok: false,
      action: request.action,
      riskReducingOnly: true,
      clientMustPersist: false,
      message: "Unknown or disallowed action.",
      error: `Allowed: ${ALLOWED_ACTIONS.join(", ")}`,
    };
  }

  const now = new Date().toISOString();
  const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  switch (request.action) {
    case "PAUSE_ANALYSIS":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: true,
        governancePatch: { pauseAnalysis: true },
        message: "Analysis paused — cron/manual analyze should respect governance flag.",
      };

    case "PAUSE_PAPER_TRADING":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: true,
        governancePatch: { pausePaperAutoOpen: true },
        message: "Paper auto-open paused.",
      };

    case "PAUSE_LIVE_PILOT":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: true,
        pilotEmergencyStop: true,
        governancePatch: { safeMode: true },
        message: "Live pilot emergency stop engaged + safe mode on.",
      };

    case "TRIGGER_KILL_SWITCH":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: true,
        governancePatch: {
          operatorPaused: true,
          operatorPauseReason: note || "Command center kill switch",
          operatorPausedAt: now,
          cooldownUntil: cooldown,
          safeMode: true,
        },
        killSwitchPatch: {
          operatorPaused: true,
          operatorPauseReason: note || "Command center kill switch",
          operatorPausedAt: now,
          cooldownUntil: cooldown,
        },
        message: "Kill switch triggered — desk trading paused.",
      };

    case "REVIEW_PENDING_PROPOSAL":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: false,
        navigateTo: request.proposalId
          ? `/adaptation?proposal=${encodeURIComponent(request.proposalId)}`
          : "/adaptation",
        message: "Open adaptation dashboard to review proposals manually.",
      };

    case "OPEN_LIVE_SUPERVISOR":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: false,
        navigateTo: "/live-supervisor",
        message: "Navigate to live supervisor.",
      };

    case "OPEN_INCIDENT_REPORT":
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: false,
        navigateTo: "/incidents-v2",
        message: "Navigate to incident review.",
      };

    case "EXPORT_DAILY_REPORT":
      if (!report) {
        return {
          ok: false,
          action: request.action,
          riskReducingOnly: true,
          clientMustPersist: false,
          message: "Report unavailable.",
          error: "Provide command center report snapshot for export.",
        };
      }
      return {
        ok: true,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: false,
        exportReport: formatCommandCenterDailyReport(report),
        message: "Daily command center report generated.",
      };

    default:
      return {
        ok: false,
        action: request.action,
        riskReducingOnly: true,
        clientMustPersist: false,
        message: "Action not implemented.",
        error: COMMAND_CENTER_SAFETY_NOTICE,
      };
  }
}

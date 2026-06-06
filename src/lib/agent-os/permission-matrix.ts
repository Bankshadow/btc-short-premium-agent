import {
  ACTION_MIN_MODE,
  AGENT_OS_ACTION_LABELS,
  AGENT_OS_MODE_LABELS,
  modeMeetsRequirement,
} from "./mode-rules";
import type {
  AgentOsAction,
  AgentOsMode,
  PermissionMatrixResult,
} from "./types";

const ALWAYS_REQUIRES_PERMISSION: AgentOsAction[] = [
  "CHANGE_STRATEGY",
  "CHANGE_RISK_LIMIT",
  "SEND_CURSOR_TASK",
];

const TESTNET_ASSISTED_REQUIRES_PERMISSION: AgentOsAction[] = [
  "EXECUTE_TESTNET_ORDER",
  "CLOSE_TESTNET_POSITION",
];

export interface PermissionContext {
  mode: AgentOsMode;
  testnetTradesToday?: number;
  maxAutoTestnetTradesPerDay?: number;
  sessionApproved?: boolean;
  onceApproved?: boolean;
}

export function evaluatePermission(
  action: AgentOsAction,
  context: PermissionContext,
): PermissionMatrixResult {
  const requiredMode = ACTION_MIN_MODE[action];
  const mode = context.mode;

  if (action === "ENABLE_LIVE") {
    return {
      action,
      allowed: false,
      requiresPermission: true,
      blocked: true,
      reason: "Live trading is permanently locked. Enable live is not available.",
      requiredMode: "LIVE_LOCKED",
    };
  }

  if (!modeMeetsRequirement(mode, requiredMode)) {
    return {
      action,
      allowed: false,
      requiresPermission: false,
      blocked: true,
      reason: `${AGENT_OS_ACTION_LABELS[action]} requires ${AGENT_OS_MODE_LABELS[requiredMode]} mode (current: ${AGENT_OS_MODE_LABELS[mode]}).`,
      requiredMode,
    };
  }

  if (mode === "OBSERVE") {
    return {
      action,
      allowed: false,
      requiresPermission: false,
      blocked: true,
      reason: "Observe mode is read-only.",
      requiredMode,
    };
  }

  if (ALWAYS_REQUIRES_PERMISSION.includes(action)) {
    const approved = Boolean(context.sessionApproved || context.onceApproved);
    return {
      action,
      allowed: approved,
      requiresPermission: true,
      blocked: !approved,
      reason: approved
        ? `${AGENT_OS_ACTION_LABELS[action]} approved for this request.`
        : `${AGENT_OS_ACTION_LABELS[action]} requires operator approval.`,
      requiredMode,
    };
  }

  if (
    mode === "TESTNET_ASSISTED" &&
    TESTNET_ASSISTED_REQUIRES_PERMISSION.includes(action)
  ) {
    const approved = Boolean(context.sessionApproved || context.onceApproved);
    return {
      action,
      allowed: approved,
      requiresPermission: true,
      blocked: !approved,
      reason: approved
        ? `Testnet ${action === "CLOSE_TESTNET_POSITION" ? "close" : "execute"} approved.`
        : "Testnet assisted mode — preview auto-created; execute/close needs your permission.",
      requiredMode,
    };
  }

  if (mode === "TESTNET_ALLOW_ALL_SAFE" && action === "EXECUTE_TESTNET_ORDER") {
    const today = context.testnetTradesToday ?? 0;
    const max = context.maxAutoTestnetTradesPerDay ?? 5;
    if (today >= max) {
      return {
        action,
        allowed: false,
        requiresPermission: true,
        blocked: true,
        reason: `Daily auto-testnet limit (${max}) reached — permission required.`,
        requiredMode,
      };
    }
    return {
      action,
      allowed: true,
      requiresPermission: false,
      blocked: false,
      reason: `Auto-testnet allowed (${today + 1}/${max} today). AI self-check passed.`,
      requiredMode,
    };
  }

  if (mode === "TESTNET_ALLOW_ALL_SAFE" && action === "CLOSE_TESTNET_POSITION") {
    return {
      action,
      allowed: true,
      requiresPermission: false,
      blocked: false,
      reason: "Auto close within safe testnet limits. AI self-check before action.",
      requiredMode,
    };
  }

  if (action === "CREATE_TESTNET_PREVIEW" && modeMeetsRequirement(mode, "TESTNET_ASSISTED")) {
    return {
      action,
      allowed: true,
      requiresPermission: false,
      blocked: false,
      reason: "Testnet preview created automatically in assisted/auto-safe modes.",
      requiredMode,
    };
  }

  return {
    action,
    allowed: true,
    requiresPermission: false,
    blocked: false,
    reason: `${AGENT_OS_ACTION_LABELS[action]} allowed in ${AGENT_OS_MODE_LABELS[mode]} mode.`,
    requiredMode,
  };
}

export function evaluateAllPermissions(
  context: PermissionContext,
): PermissionMatrixResult[] {
  const actions: AgentOsAction[] = [
    "RUN_ANALYSIS",
    "CREATE_DECISION",
    "CREATE_PAPER_TRADE",
    "CREATE_SHADOW_TRADE",
    "CREATE_TESTNET_PREVIEW",
    "EXECUTE_TESTNET_ORDER",
    "CLOSE_TESTNET_POSITION",
    "CHANGE_STRATEGY",
    "CHANGE_RISK_LIMIT",
    "SEND_CURSOR_TASK",
    "ENABLE_LIVE",
  ];
  return actions.map((action) => evaluatePermission(action, context));
}

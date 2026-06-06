import type { AgentOsMode } from "./types";

export const AGENT_OS_MODE_LABELS: Record<AgentOsMode, string> = {
  OBSERVE: "Observe",
  ANALYZE: "Analyze",
  PAPER_AUTOPILOT: "Paper autopilot",
  TESTNET_ASSISTED: "Testnet assisted",
  TESTNET_ALLOW_ALL_SAFE: "Testnet auto (safe limits)",
  LIVE_LOCKED: "Live locked",
};

export const AGENT_OS_MODE_DESCRIPTIONS: Record<AgentOsMode, string> = {
  OBSERVE: "Read-only — updates dashboard, no AI cycles or orders.",
  ANALYZE: "Think — run AI analysis and create decisions. No orders.",
  PAPER_AUTOPILOT: "Act on paper — create paper and shadow records only.",
  TESTNET_ASSISTED: "Testnet assisted — auto preview, ask before execute or close.",
  TESTNET_ALLOW_ALL_SAFE: "Auto testnet within strict daily limits. AI self-checks each action. Live locked.",
  LIVE_LOCKED: "Live execution permanently locked.",
};

export const AGENT_OS_ACTION_LABELS: Record<
  import("./types").AgentOsAction,
  string
> = {
  RUN_ANALYSIS: "Run analysis",
  CREATE_DECISION: "Create decision",
  CREATE_PAPER_TRADE: "Create paper trade",
  CREATE_SHADOW_TRADE: "Create shadow trade",
  CREATE_TESTNET_PREVIEW: "Create testnet preview",
  EXECUTE_TESTNET_ORDER: "Execute testnet order",
  CLOSE_TESTNET_POSITION: "Close testnet position",
  CHANGE_STRATEGY: "Change strategy",
  CHANGE_RISK_LIMIT: "Change risk limit",
  SEND_CURSOR_TASK: "Send Cursor task",
  ENABLE_LIVE: "Enable live trading",
};

/** Minimum operating mode required for an action (LIVE_LOCKED is a constraint, not a floor). */
export const ACTION_MIN_MODE: Record<
  import("./types").AgentOsAction,
  AgentOsMode
> = {
  RUN_ANALYSIS: "ANALYZE",
  CREATE_DECISION: "ANALYZE",
  CREATE_PAPER_TRADE: "PAPER_AUTOPILOT",
  CREATE_SHADOW_TRADE: "PAPER_AUTOPILOT",
  CREATE_TESTNET_PREVIEW: "TESTNET_ASSISTED",
  EXECUTE_TESTNET_ORDER: "TESTNET_ASSISTED",
  CLOSE_TESTNET_POSITION: "TESTNET_ASSISTED",
  CHANGE_STRATEGY: "ANALYZE",
  CHANGE_RISK_LIMIT: "ANALYZE",
  SEND_CURSOR_TASK: "ANALYZE",
  ENABLE_LIVE: "LIVE_LOCKED",
};

const MODE_RANK: Record<AgentOsMode, number> = {
  OBSERVE: 0,
  ANALYZE: 1,
  PAPER_AUTOPILOT: 2,
  TESTNET_ASSISTED: 3,
  TESTNET_ALLOW_ALL_SAFE: 4,
  LIVE_LOCKED: 99,
};

export function modeMeetsRequirement(
  current: AgentOsMode,
  required: AgentOsMode,
): boolean {
  if (required === "LIVE_LOCKED") return false;
  return MODE_RANK[current] >= MODE_RANK[required];
}

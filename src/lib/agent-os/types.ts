export const AGENT_OS_SAFETY_NOTICE =
  "Trading Agent OS: Think · Act · Ask. Live trading remains locked. Testnet execution requires permission unless explicitly enabled with safe limits.";

export type AgentOsMode =
  | "OBSERVE"
  | "ANALYZE"
  | "PAPER_AUTOPILOT"
  | "TESTNET_ASSISTED"
  | "TESTNET_ALLOW_ALL_SAFE"
  | "LIVE_LOCKED";

export type AgentOsAction =
  | "RUN_ANALYSIS"
  | "CREATE_DECISION"
  | "CREATE_PAPER_TRADE"
  | "CREATE_SHADOW_TRADE"
  | "CREATE_TESTNET_PREVIEW"
  | "EXECUTE_TESTNET_ORDER"
  | "CLOSE_TESTNET_POSITION"
  | "CHANGE_STRATEGY"
  | "CHANGE_RISK_LIMIT"
  | "SEND_CURSOR_TASK"
  | "ENABLE_LIVE";

export type PermissionApprovalScope = "once" | "session" | "denied";

export interface PermissionMatrixResult {
  action: AgentOsAction;
  allowed: boolean;
  requiresPermission: boolean;
  blocked: boolean;
  reason: string;
  requiredMode: AgentOsMode;
}

export interface PermissionAuditEvent {
  id: string;
  action: AgentOsAction;
  approved: boolean;
  actor: string;
  timestamp: string;
  reason: string;
  linkedTradeId: string | null;
  linkedDecisionId: string | null;
  approvalScope: PermissionApprovalScope | null;
  mode: AgentOsMode;
}

export interface PermissionPromptRequest {
  action: AgentOsAction;
  title: string;
  why: string;
  risk: string;
  expectedResult: string;
  linkedTradeId?: string | null;
  linkedDecisionId?: string | null;
  sessionSafe?: boolean;
}

export interface AgentOsSettings {
  observeOnly: boolean;
  testnetAllowAllSafe: boolean;
  testnetAllowAllExplicitlyEnabled: boolean;
  maxAutoTestnetTradesPerDay: number;
}

export const DEFAULT_AGENT_OS_SETTINGS: AgentOsSettings = {
  observeOnly: false,
  testnetAllowAllSafe: false,
  testnetAllowAllExplicitlyEnabled: false,
  maxAutoTestnetTradesPerDay: 5,
};

export interface AgentOsModeInput {
  observeOnly?: boolean;
  autopilotEnabled?: boolean;
  paperAutopilotEnabled?: boolean;
  shadowModeEnabled?: boolean;
  testnetConnected?: boolean;
  automationEnabled?: boolean;
  testnetAllowAllSafe?: boolean;
  testnetAllowAllExplicitlyEnabled?: boolean;
}

export interface AgentOsDashboardState {
  mode: AgentOsMode;
  modeLabel: string;
  currentAction: string;
  permissionNeeded: boolean;
  nextAction: string;
  goalProgressPct: number | null;
  liveLocked: true;
  thinksActsAsks: {
    think: string;
    act: string;
    ask: string;
  };
  pendingPermission: PermissionPromptRequest | null;
}

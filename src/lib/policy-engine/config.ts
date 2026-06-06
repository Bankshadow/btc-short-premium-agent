import type { PolicyActionType, PolicyRuleDefinition } from "./types";

export const POLICY_AUDIT_FILE = "policy-decisions.json";
export const POLICY_MAX_AUDIT = 200;

export const LIVE_POLICY_ACTIONS: PolicyActionType[] = [
  "PREVIEW_LIVE_ORDER",
  "EXECUTE_LIVE_PERP",
  "EXECUTE_OPTIONS_LIVE",
  "PROMOTE_LIVE_STAGE",
];

export const POLICY_RULES: PolicyRuleDefinition[] = [
  {
    id: "role_permission",
    label: "Workspace role permission",
    description: "Action requires matching workspace role permission.",
    appliesTo: [
      "RUN_ANALYSIS",
      "CREATE_PAPER_TRADE",
      "CREATE_SHADOW_TRADE",
      "PREVIEW_LIVE_ORDER",
      "EXECUTE_LIVE_PERP",
      "EXECUTE_OPTIONS_TESTNET",
      "EXECUTE_OPTIONS_LIVE",
      "CHANGE_RISK_PROFILE",
      "APPROVE_STRATEGY_CHANGE",
      "ENABLE_AUTOPILOT",
      "TRIGGER_KILL_SWITCH",
      "PROMOTE_LIVE_STAGE",
    ],
    severity: "hard",
  },
  {
    id: "live_human_approval",
    label: "Live requires human approval",
    description: "Live perp execution requires explicit operator approval.",
    appliesTo: ["EXECUTE_LIVE_PERP"],
    severity: "hard",
  },
  {
    id: "command_center_safe",
    label: "Command center must be SAFE for live",
    description: "Live actions blocked when command center is not SAFE.",
    appliesTo: ["PREVIEW_LIVE_ORDER", "EXECUTE_LIVE_PERP", "PROMOTE_LIVE_STAGE"],
    severity: "hard",
  },
  {
    id: "backbone_healthy",
    label: "Data backbone healthy",
    description: "Live actions blocked when desk backbone is unhealthy.",
    appliesTo: ["EXECUTE_LIVE_PERP", "PREVIEW_LIVE_ORDER", "PROMOTE_LIVE_STAGE"],
    severity: "hard",
  },
  {
    id: "audit_available",
    label: "Audit trail available",
    description: "Live execution blocked when audit logging unavailable.",
    appliesTo: ["EXECUTE_LIVE_PERP", "EXECUTE_OPTIONS_LIVE"],
    severity: "hard",
  },
  {
    id: "data_trust_live",
    label: "Data trust for live",
    description: "CRITICAL data trust blocks live actions.",
    appliesTo: ["PREVIEW_LIVE_ORDER", "EXECUTE_LIVE_PERP", "CREATE_PAPER_TRADE"],
    severity: "hard",
  },
  {
    id: "governance_pause",
    label: "Governance pause",
    description: "Governance pause blocks analysis and new trades.",
    appliesTo: [
      "RUN_ANALYSIS",
      "CREATE_PAPER_TRADE",
      "CREATE_SHADOW_TRADE",
      "ENABLE_AUTOPILOT",
    ],
    severity: "hard",
  },
  {
    id: "kill_switch",
    label: "Kill switch active",
    description: "Kill switch blocks new risk-increasing actions.",
    appliesTo: [
      "CREATE_PAPER_TRADE",
      "PREVIEW_LIVE_ORDER",
      "EXECUTE_LIVE_PERP",
      "ENABLE_AUTOPILOT",
    ],
    severity: "hard",
  },
  {
    id: "pre_mortem_block",
    label: "Pre-mortem block",
    description: "Pre-mortem BLOCK prevents paper/live ticket creation.",
    appliesTo: ["CREATE_PAPER_TRADE", "EXECUTE_LIVE_PERP", "EXECUTE_OPTIONS_TESTNET"],
    severity: "hard",
  },
  {
    id: "conflict_gate",
    label: "Conflict gate",
    description: "Agent conflict gate blocks trade actions.",
    appliesTo: ["CREATE_PAPER_TRADE", "EXECUTE_LIVE_PERP"],
    severity: "hard",
  },
  {
    id: "paper_risk_veto",
    label: "Hard risk veto",
    description: "Risk manager hard veto blocks strict paper; shadow may proceed.",
    appliesTo: ["CREATE_PAPER_TRADE"],
    severity: "hard",
  },
  {
    id: "shadow_relaxed",
    label: "Shadow relaxed conditions",
    description: "Shadow trades allowed under relaxed governance when strict paper blocked.",
    appliesTo: ["CREATE_SHADOW_TRADE"],
    severity: "soft",
  },
  {
    id: "aggressive_disabled",
    label: "Aggressive mode disabled",
    description: "Governance disableAggressiveMode blocks promotion actions.",
    appliesTo: ["PROMOTE_LIVE_STAGE", "ENABLE_AUTOPILOT"],
    severity: "hard",
  },
  {
    id: "kill_switch_reduce_only",
    label: "Kill switch reduce-only",
    description: "Kill switch trigger may only reduce risk.",
    appliesTo: ["TRIGGER_KILL_SWITCH"],
    severity: "hard",
  },
  {
    id: "options_live_unavailable",
    label: "Options live unavailable",
    description: "BTC options live execution not implemented.",
    appliesTo: ["EXECUTE_OPTIONS_LIVE"],
    severity: "hard",
  },
  {
    id: "live_readiness",
    label: "Live readiness",
    description: "Live readiness FAIL blocks live pilot actions.",
    appliesTo: ["PREVIEW_LIVE_ORDER", "EXECUTE_LIVE_PERP"],
    severity: "hard",
  },
];

export const POLICY_ACTION_LABELS: Record<PolicyActionType, string> = {
  RUN_ANALYSIS: "Run desk analysis",
  CREATE_PAPER_TRADE: "Create paper trade",
  CREATE_SHADOW_TRADE: "Create shadow trade",
  PREVIEW_LIVE_ORDER: "Preview live order",
  EXECUTE_LIVE_PERP: "Execute live perp",
  EXECUTE_OPTIONS_TESTNET: "Execute options testnet",
  EXECUTE_OPTIONS_LIVE: "Execute options live",
  CHANGE_RISK_PROFILE: "Change risk profile",
  APPROVE_STRATEGY_CHANGE: "Approve strategy change",
  ENABLE_AUTOPILOT: "Enable autopilot",
  TRIGGER_KILL_SWITCH: "Trigger kill switch",
  PROMOTE_LIVE_STAGE: "Promote live stage",
};

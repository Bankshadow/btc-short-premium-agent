/** Canonical goal-mode information architecture (primary + advanced nav). */

export const GOAL_DASHBOARD_SECTIONS = [
  "Mission",
  "AI State",
  "Position",
  "Latest Decision",
  "Risk",
  "One Button",
] as const;

export const GOAL_TRADES_SECTIONS = [
  "Open trades",
  "Closed trades",
  "PnL",
  "Trade detail timeline",
] as const;

export const GOAL_AI_STATUS_SECTIONS = [
  "Engine state",
  "Current step",
  "Recent events",
  "Blockers",
  "Permission needed",
] as const;

export const GOAL_REPORTS_SECTIONS = [
  "Daily summary",
  "Evidence progress",
  "Strategy health",
  "Learning",
  "Risk/readiness",
] as const;

export const GOAL_SETTINGS_SECTIONS = [
  "Mission",
  "Risk limits",
  "Binance/Testnet",
  "Notifications",
  "Skills",
  "Advanced toggle",
] as const;

export interface GoalAdvancedModuleLink {
  label: string;
  href: string;
  description: string;
}

/** Fixed Advanced module list — power-user modules only. */
export const GOAL_ADVANCED_MODULES: GoalAdvancedModuleLink[] = [
  {
    label: "Engine Health",
    href: "/advanced/engine-health",
    description: "Central engine inputs — missing or stale modules block analyze/trade/learn.",
  },
  {
    label: "Reconciliation",
    href: "/advanced/reconciliation",
    description: "Cross-store consistency — journals, positions, decisions, and learning records.",
  },
  {
    label: "Evidence Quality",
    href: "/advanced/evidence-quality",
    description: "Validate completed trades as usable evidence for strategy evaluation.",
  },
  {
    label: "Quality & Calibration",
    href: "/reports",
    description: "Trade quality dimensions and AI confidence calibration from closed trades.",
  },
  {
    label: "Strategy & Agents",
    href: "/reports",
    description: "Strategy health status and agent scoreboard v2 from completed testnet trades.",
  },
  {
    label: "Strategy Registry",
    href: "/strategies",
    description: "Strategy skills, statuses, and analyze payload gates.",
  },
  {
    label: "Governance",
    href: "/governance",
    description: "Safe mode, hard rules, operator pause, and override audit.",
  },
  {
    label: "Validation",
    href: "/validation",
    description: "Kill switch, performance matrix, and validation blockers.",
  },
  {
    label: "Council",
    href: "/council",
    description: "Multi-agent committee proposals and weighted verdict.",
  },
  {
    label: "Simulation",
    href: "/simulation",
    description: "Capital risk and rule impact simulators — advisory only.",
  },
  {
    label: "War Room",
    href: "/war-room",
    description: "Operator drills and emergency scenario playbook.",
  },
  {
    label: "Incidents",
    href: "/incidents",
    description: "Desk incidents, post-mortems, and open critical blocks.",
  },
  {
    label: "Raw Ledger",
    href: "/ledger",
    description: "Unified decision and trade ledger audit trail.",
  },
  {
    label: "API Docs",
    href: "/api-docs",
    description: "HTTP API contract for integrators.",
  },
];

export const GOAL_SETTINGS_KEY = "btc-desk:goal-settings";

export interface GoalSettings {
  startCapital: number;
  targetCapital: number;
  environmentMode: "PAPER" | "TESTNET" | "PAPER_TESTNET" | "LIVE";
  showPaper: boolean;
  showTestnet: boolean;
  showLive: boolean;
  dailyLossLimitPct: number;
  notifyOnTrade: boolean;
  notifyOnBlocker: boolean;
  advancedMode: boolean;
}

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  startCapital: 1_000,
  targetCapital: 10_000,
  environmentMode: "PAPER_TESTNET",
  showPaper: true,
  showTestnet: true,
  showLive: false,
  dailyLossLimitPct: 3,
  notifyOnTrade: true,
  notifyOnBlocker: true,
  advancedMode: false,
};

export function loadGoalSettings(): GoalSettings {
  if (typeof window === "undefined") return DEFAULT_GOAL_SETTINGS;
  try {
    const raw = localStorage.getItem(GOAL_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_GOAL_SETTINGS, ...(JSON.parse(raw) as Partial<GoalSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_GOAL_SETTINGS;
}

export function saveGoalSettings(settings: GoalSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOAL_SETTINGS_KEY, JSON.stringify(settings));
}

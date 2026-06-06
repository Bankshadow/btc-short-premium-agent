export type EmptyStatePreset = {
  title: string;
  missing: string;
  why: string;
  actionLabel: string;
  actionHref?: string;
};

export const COCKPIT_EMPTY: EmptyStatePreset = {
  title: "Start here",
  missing: "The desk has not run a cycle yet.",
  why: "One cycle reads the market, checks risk, and tells you what to do next.",
  actionLabel: "Run desk cycle",
};

export const VERDICT_EMPTY: EmptyStatePreset = {
  title: "No recommendation yet",
  missing: "The AI has not reviewed today's setup.",
  why: "After a cycle you get a clear trade, wait, or skip call with reasons.",
  actionLabel: "Run desk cycle",
};

export const ACTIONS_EMPTY: EmptyStatePreset = {
  title: "Nothing urgent",
  missing: "No items need your attention right now.",
  why: "Unresolved trades, validation gaps, and risk issues appear here first.",
  actionLabel: "Check autopilot",
  actionHref: "/autopilot",
};

export const NOTIFICATIONS_EMPTY: EmptyStatePreset = {
  title: "All quiet",
  missing: "No recent alerts.",
  why: "Trade signals, blockers, and paper lifecycle updates show up here.",
  actionLabel: "Alert settings",
  actionHref: "/notifications",
};

export const PORTFOLIO_EMPTY: EmptyStatePreset = {
  title: "No paper trades",
  missing: "Your paper book is empty.",
  why: "Enable autopilot or act on a trade verdict to start learning safely.",
  actionLabel: "Open portfolio",
  actionHref: "/portfolio",
};

export const LEARNING_EMPTY: EmptyStatePreset = {
  title: "Learning not started",
  missing: "Not enough resolved outcomes yet.",
  why: "Close and resolve paper trades to build validation sample size.",
  actionLabel: "View validation",
  actionHref: "/validation",
};

export const LIVE_READINESS_EMPTY: EmptyStatePreset = {
  title: "Live readiness unknown",
  missing: "Live pilot status has not been assessed.",
  why: "Readiness checks paper history, risk gates, and infrastructure before live.",
  actionLabel: "View live readiness",
  actionHref: "/live-readiness",
};

export const ADVANCED_DRAWERS_EMPTY: EmptyStatePreset = {
  title: "No technical details yet",
  missing: "Run a desk cycle to populate advanced panels.",
  why: "Agent debate, raw data, and timelines appear after the first analysis.",
  actionLabel: "Run desk cycle",
};

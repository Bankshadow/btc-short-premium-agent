import { OPS_MODULE_LINKS, type OpsAccent } from "./ops-theme";

export type NavLink = {
  href: string;
  label: string;
  accent: OpsAccent;
};

/** P-MVP 6 — platform cockpit navigation */
export const PRIMARY_NAV: NavLink[] = [
  { href: "/", label: "Cockpit", accent: "amber" },
  { href: "/autopilot", label: "Autopilot", accent: "cyan" },
  { href: "/portfolio", label: "Portfolio", accent: "teal" },
  { href: "/actions", label: "Actions", accent: "indigo" },
  { href: "/notifications", label: "Notifications", accent: "amber" },
];

export const TRADING_NAV: NavLink[] = [
  { href: "/strategies", label: "Strategies", accent: "indigo" },
  { href: "/validation", label: "Validation", accent: "teal" },
  { href: "/capital", label: "Capital", accent: "violet" },
  { href: "/ledger", label: "Ledger", accent: "indigo" },
  { href: "/reports", label: "Reports", accent: "cyan" },
];

export const PLATFORM_NAV: NavLink[] = [
  { href: "/settings/workspace", label: "Workspace", accent: "indigo" },
  { href: "/data", label: "Data", accent: "cyan" },
  { href: "/automation-control", label: "Automation Control", accent: "cyan" },
  { href: "/policies", label: "Policies", accent: "rose" },
  { href: "/governance", label: "Governance", accent: "rose" },
  { href: "/audit", label: "Audit", accent: "indigo" },
  { href: "/admin/health", label: "Admin", accent: "rose" },
];

export const ADVANCED_NAV: NavLink[] = [
  { href: "/automation", label: "Agents", accent: "cyan" },
  { href: "/council", label: "Council", accent: "amber" },
  { href: "/simulation", label: "Simulation", accent: "violet" },
  { href: "/war-room", label: "War Room", accent: "rose" },
  { href: "/api-docs", label: "API Docs", accent: "cyan" },
];

/** @deprecated Use TRADING_NAV — kept for gradual migration */
export const SECONDARY_NAV = TRADING_NAV;

/** Hidden routes still reachable via OpsShell / direct URL */
export const HIDDEN_MODULE_NAV: NavLink[] = [
  { href: "/live-trading", label: "Live plan", accent: "rose" },
  { href: "/live-readiness", label: "Live readiness", accent: "emerald" },
  { href: "/command-center", label: "Command center", accent: "rose" },
  { href: "/incidents", label: "Incidents", accent: "rose" },
  { href: "/worker", label: "Worker", accent: "cyan" },
  { href: "/warehouse", label: "Warehouse", accent: "indigo" },
  { href: "/summary", label: "Public Summary", accent: "emerald" },
];

/** Full module list preserved for OpsShell pages — all routes remain accessible */
export { OPS_MODULE_LINKS };

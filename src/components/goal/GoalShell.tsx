"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export interface GoalNavLink {
  href: string;
  label: string;
}

export const GOAL_PRIMARY_NAV: GoalNavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/ai-status", label: "AI Status" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export const GOAL_ADVANCED_NAV: GoalNavLink[] = [
  { href: "/cockpit", label: "Cockpit (legacy)" },
  { href: "/autopilot", label: "Autopilot internals" },
  { href: "/portfolio", label: "Portfolio (raw)" },
  { href: "/actions", label: "Actions (raw)" },
  { href: "/notifications", label: "Notifications (raw)" },
  { href: "/strategies", label: "Strategies" },
  { href: "/validation", label: "Validation" },
  { href: "/capital", label: "Capital" },
  { href: "/ledger", label: "Ledger" },
  { href: "/workspace", label: "Workspace" },
  { href: "/data", label: "Data" },
  { href: "/automation-control", label: "Automation Control" },
  { href: "/policies", label: "Policies" },
  { href: "/governance", label: "Governance" },
  { href: "/audit", label: "Audit" },
  { href: "/admin/health", label: "Admin" },
  { href: "/council", label: "Agents / Council" },
  { href: "/simulation", label: "Simulation" },
  { href: "/war-room", label: "War Room" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/binance-testnet", label: "Binance Testnet Debug" },
  { href: "/testnet-monitor", label: "Testnet Monitor Debug" },
  { href: "/strategy-health", label: "Strategy Health" },
  { href: "/execution-quality", label: "Execution Quality" },
  { href: "/live-evidence", label: "Live Evidence" },
  { href: "/live-readiness", label: "Live Readiness" },
  { href: "/learning", label: "Learning" },
  { href: "/command-center", label: "Command Center" },
  { href: "/project-strategist", label: "Project Strategist" },
];

export default function GoalShell({
  title,
  subtitle,
  activePath,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  activePath: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 px-3 py-5 sm:px-6 sm:py-6">
      <header className="desk-panel relative overflow-hidden px-5 py-5 sm:px-6">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="desk-section-title text-emerald-300/90">AI Profit Mission</p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
              {subtitle}
            </p>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <nav className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-4">
          {GOAL_PRIMARY_NAV.map((link) => {
            const active = activePath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                    : "rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                }
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="ml-auto rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showAdvanced ? "Hide advanced" : "Advanced"}
          </button>
        </nav>

        {showAdvanced && (
          <div className="relative mt-3 flex flex-wrap gap-1.5 border-t border-zinc-900 pt-3">
            {GOAL_ADVANCED_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-zinc-800/80 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500 transition hover:text-zinc-300"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {children}
    </div>
  );
}

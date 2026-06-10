"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import TrustMeter from "./TrustMeter";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import { useGoalShellMotion } from "@/hooks/useHomePageMotion";

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
  { href: "/advanced", label: "Advanced" },
];

import { GOAL_ADVANCED_MODULES } from "@/lib/ux/goal-nav-spec";

export const GOAL_ADVANCED_NAV: GoalNavLink[] = [
  ...GOAL_ADVANCED_MODULES.map((m) => ({ href: m.href, label: m.label })),
  { href: "/capital", label: "Capital" },
  { href: "/automation", label: "Automation" },
  { href: "/testnet-monitor", label: "Debug (Testnet Monitor)" },
  { href: "/cockpit", label: "Cockpit (legacy)" },
  { href: "/command-center", label: "Command Center" },
  { href: "/learning", label: "Learning" },
];

export default function GoalShell({
  title,
  subtitle,
  activePath,
  actions,
  missionSnapshot,
  enableMotion = false,
  children,
}: {
  title: string;
  subtitle: string;
  activePath: string;
  actions?: ReactNode;
  missionSnapshot?: MissionFlowSnapshot | null;
  enableMotion?: boolean;
  children: ReactNode;
}) {
  const shellRef = useGoalShellMotion(enableMotion);

  return (
    <div
      ref={enableMotion ? shellRef : undefined}
      className="mx-auto w-full max-w-[1200px] space-y-5 px-3 py-5 sm:px-6 sm:py-6"
    >
      <header
        data-home-header-block={enableMotion ? "" : undefined}
        className="desk-panel relative overflow-hidden px-5 py-5 sm:px-6"
      >
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
                data-home-nav-link={enableMotion ? "" : undefined}
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
        </nav>
      </header>

      {missionSnapshot && (
        <div data-home-panel={enableMotion ? "" : undefined}>
          <TrustMeter
            trust={missionSnapshot.trust}
            trustNotionalUsd={missionSnapshot.trustNotionalUsd}
            compact={false}
          />
        </div>
      )}

      {children}
    </div>
  );
}

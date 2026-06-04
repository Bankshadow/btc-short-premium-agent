"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { OPS_ACCENT, OPS_MODULE_LINKS, type OpsAccent } from "./ops-theme";

interface OpsNavLink {
  href: string;
  label: string;
  primary?: boolean;
}

interface OpsShellProps {
  badge: string;
  title: string;
  subtitle: string;
  accent: OpsAccent;
  iconLetters?: string;
  actions?: ReactNode;
  nav?: OpsNavLink[];
  showModuleStrip?: boolean;
  activePath?: string;
  children: ReactNode;
}

export function OpsKpi({
  label,
  value,
  hint,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="ops-kpi">
      <p className="ops-kpi-label">{label}</p>
      <p className={`ops-kpi-value ${mono ? "font-mono" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] leading-snug text-zinc-600">{hint}</p>}
    </div>
  );
}

export default function OpsShell({
  badge,
  title,
  subtitle,
  accent,
  iconLetters = "OS",
  actions,
  nav,
  showModuleStrip = true,
  activePath,
  children,
}: OpsShellProps) {
  const theme = OPS_ACCENT[accent];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-3 py-5 sm:px-6 sm:py-6">
      <header
        className={`desk-panel relative overflow-hidden px-5 py-5 sm:px-6 ${theme.glow}`}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-white/[0.04] to-transparent blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-mono text-sm font-bold ring-1 ${theme.icon}`}
            >
              {iconLetters}
            </div>
            <div className="min-w-0">
              <p className={`desk-section-title ${theme.badge}`}>{badge}</p>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                {title}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
                {subtitle}
              </p>
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>

        {(nav?.length || showModuleStrip) && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-4">
            {nav?.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.primary
                    ? `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${theme.link}`
                    : "rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                }
              >
                {link.label}
              </Link>
            ))}
            {showModuleStrip && (
              <div className="ml-auto hidden flex-wrap gap-1 lg:flex">
                {OPS_MODULE_LINKS.map((m) => {
                  const t = OPS_ACCENT[m.accent];
                  const active = activePath === m.href;
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition ${
                        active
                          ? `${t.link} ring-1 ${t.ring}`
                          : "text-zinc-600 hover:text-zinc-400"
                      }`}
                    >
                      {m.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>

      {children}
    </div>
  );
}

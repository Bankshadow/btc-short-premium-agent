"use client";

import { useState } from "react";
import Link from "next/link";
import { DESK_PROFILES } from "@/lib/trading-os/desk-profiles";
import {
  ENVIRONMENT_MODE_LABELS,
  resolveModeEffects,
} from "@/lib/trading-os/environment-modes";
import {
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  setActiveProfile,
  setEnvironmentMode,
} from "@/lib/trading-os/workspace-store";
import type { DeskProfileId, EnvironmentMode } from "@/lib/trading-os/trading-os-types";

const MODES: EnvironmentMode[] = ["DEMO", "PAPER", "SEMI_LIVE", "SAFE_MODE"];

export default function WorkspaceDashboard() {
  const [config, setConfig] = useState(loadWorkspaceConfig);

  const effects = resolveModeEffects(config.environmentMode, config.activeProfileId);

  const refresh = () => setConfig(loadWorkspaceConfig());

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel px-4 py-4">
        <p className="desk-section-title text-cyan-400/90">MVP 15 · Trading OS</p>
        <h1 className="text-lg font-semibold text-zinc-50">Workspace & desk config</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Reusable AI Trading Desk OS — profiles and environment modes shape paper,
          tickets, and governance. No fully automatic live trading.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">
            ← Private desk
          </Link>
          <Link href="/summary" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">
            Public summary
          </Link>
          <Link href="/api-docs" className="rounded-lg border border-cyan-900/50 px-3 py-1.5 text-xs text-cyan-300">
            API docs
          </Link>
          <Link href="/reports" className="rounded-lg border border-cyan-900/50 px-3 py-1.5 text-xs text-cyan-300">
            Reports
          </Link>
        </div>
      </header>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Desk profiles</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DESK_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveProfile(p.id);
                refresh();
              }}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                config.activeProfileId === p.id
                  ? "border-cyan-600/50 bg-cyan-950/30"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <p className="font-medium text-zinc-100">{p.name}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{p.tagline}</p>
              <p className="mt-2 text-[10px] text-zinc-600">{p.symbolFocus}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Environment mode</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setEnvironmentMode(m);
                refresh();
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                config.environmentMode === m
                  ? "bg-cyan-800/60 text-cyan-100 ring-1 ring-cyan-600/40"
                  : "bg-zinc-900 text-zinc-400"
              }`}
            >
              {ENVIRONMENT_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <dl className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Mock fallback</dt>
            <dd className="text-zinc-200">{effects.allowMockFallback ? "allowed" : "blocked"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Paper auto-open</dt>
            <dd className="text-zinc-200">{effects.allowPaperAutoOpen ? "on" : "off"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Order tickets</dt>
            <dd className="text-zinc-200">{effects.allowOrderTickets ? "on" : "off"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Human approval</dt>
            <dd className="text-zinc-200">
              {effects.requireHumanApproval ? "required" : "optional"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-600">{effects.analysisOnlyLabel}</p>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">View mode</h2>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              saveWorkspaceConfig({ viewMode: "private" });
              refresh();
            }}
            className={`rounded px-3 py-1.5 text-xs ${
              config.viewMode === "private"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Private operator dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              saveWorkspaceConfig({ viewMode: "public" });
              refresh();
            }}
            className={`rounded px-3 py-1.5 text-xs ${
              config.viewMode === "public"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Public summary layout
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          Public view hides operator/replay tools on the main desk; use /summary for
          external sharing.
        </p>
      </section>
    </div>
  );
}

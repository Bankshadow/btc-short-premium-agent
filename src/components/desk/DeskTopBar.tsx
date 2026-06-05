"use client";

import Link from "next/link";
import { DESK_REFRESH_OPTIONS } from "@/hooks/useAutoDeskRefresh";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface DeskTopBarProps {
  deskLive: boolean;
  loading: boolean;
  lastAnalyzedAt: string | null;
  secondsUntilRefresh: number;
  autoRefreshEnabled: boolean;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (ms: number) => void;
  onToggleAutoRefresh: () => void;
  onRefreshNow: () => void;
  usingFallback?: boolean;
  profileLabel?: string;
  environmentModeLabel?: string;
}

export default function DeskTopBar({
  deskLive,
  loading,
  lastAnalyzedAt,
  secondsUntilRefresh,
  autoRefreshEnabled,
  refreshIntervalMs,
  onRefreshIntervalChange,
  onToggleAutoRefresh,
  onRefreshNow,
  usingFallback,
  profileLabel,
  environmentModeLabel,
}: DeskTopBarProps) {
  const lastLabel = lastAnalyzedAt
    ? new Date(lastAnalyzedAt).toLocaleString()
    : "—";

  return (
    <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/30 to-emerald-600/20 font-mono text-sm font-bold text-amber-100 ring-1 ring-amber-500/30">
          TD
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-semibold tracking-tight text-zinc-50">
            {profileLabel ?? "BTC Premium Trading Desk"}
          </h1>
          <p className="text-xs text-zinc-500">
            {environmentModeLabel
              ? `${environmentModeLabel} · `
              : ""}
            Multi-agent committee · analysis only
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-1.5">
          <span
            className={`relative flex h-2.5 w-2.5 ${deskLive || loading ? "" : "opacity-40"}`}
          >
            {(deskLive || loading) && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                loading
                  ? "bg-amber-400"
                  : deskLive
                    ? "bg-emerald-400"
                    : "bg-zinc-600"
              }`}
            />
          </span>
          <span className="text-xs font-medium text-zinc-300">
            {loading
              ? "Desk in session…"
              : deskLive
                ? "Desk live"
                : "Connecting…"}
          </span>
        </div>

        {usingFallback && (
          <span className="rounded bg-amber-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-800">
            Demo tape
          </span>
        )}

        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Last committee run
          </p>
          <p className="font-mono text-xs text-zinc-300">{lastLabel}</p>
        </div>

        <nav
          className="hidden items-center gap-0.5 rounded-lg border border-zinc-800/90 bg-zinc-950/60 p-0.5 lg:flex"
          aria-label="Ops modules"
        >
          <Link
            href="/automation"
            className="rounded-md border border-cyan-900/40 bg-cyan-950/50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/95 hover:bg-cyan-900/45"
          >
            AI
          </Link>
          <Link
            href="/portfolio"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300/95 hover:bg-teal-900/45"
          >
            Portfolio
          </Link>
          <Link
            href="/assets"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/95 hover:bg-emerald-900/45"
          >
            Assets
          </Link>
          <Link
            href="/council"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95 hover:bg-amber-900/45"
          >
            Council
          </Link>
          <Link
            href="/mortem"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 hover:bg-emerald-950/50"
          >
            Mortem
          </Link>
          <Link
            href="/simulation"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400/90 hover:bg-violet-950/50"
          >
            Sim
          </Link>
          <Link
            href="/war-room"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400/90 hover:bg-rose-950/50"
          >
            War
          </Link>
          <Link
            href="/capital"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400/90 hover:bg-violet-950/50"
          >
            Capital
          </Link>
          <Link
            href="/adaptation"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-400/90 hover:bg-indigo-950/50"
          >
            Adapt
          </Link>
          <Link
            href="/live-readiness"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 hover:bg-emerald-950/50"
          >
            Ready
          </Link>
          <Link
            href="/live-pilot"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 hover:bg-emerald-950/50"
          >
            Pilot
          </Link>
          <Link
            href="/strategies"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-400/90 hover:bg-indigo-950/50"
          >
            Strategies
          </Link>
          <Link
            href="/validation"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-400/90 hover:bg-teal-950/50"
          >
            Validation
          </Link>
          <Link
            href="/governance"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400/90 hover:bg-rose-950/50"
          >
            Gov
          </Link>
          <Link
            href="/workspace"
            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400/90 hover:bg-cyan-950/50"
          >
            OS
          </Link>
        </nav>
        <Link
          href="/summary"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          Public
        </Link>

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={onToggleAutoRefresh}
              className="rounded border-zinc-600 bg-zinc-900"
            />
            Auto
          </label>
          <select
            value={refreshIntervalMs}
            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
            disabled={!autoRefreshEnabled}
            className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
            aria-label="Auto refresh interval"
          >
            {DESK_REFRESH_OPTIONS.map((opt) => (
              <option key={opt.ms} value={opt.ms}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="font-mono text-xs text-zinc-500">
            {formatCountdown(secondsUntilRefresh)}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefreshNow}
          disabled={loading}
          className="rounded-lg bg-amber-600/90 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "Running…" : "Refresh now"}
        </button>
      </div>
    </header>
  );
}

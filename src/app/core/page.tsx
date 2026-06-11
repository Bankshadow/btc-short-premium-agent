"use client";

import Link from "next/link";
import { Badge, LoadingOrError, StatCard, useApi } from "@/components/use-api";
import { useProjectionBundle } from "@/components/use-projection-bundle";
import type { CoreHealthReport } from "@/lib/core/core-health";
import type { ProjectionParityReport } from "@/lib/core/projection-parity";
import type { UiConsistencyReport } from "@/lib/core/ui-consistency-check";

function statusTone(status: string): "safe" | "blocked" | "wait" {
  if (status === "OK") return "safe";
  if (status === "WARNING") return "wait";
  return "blocked";
}

function ApiLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--accent)]"
    >
      {label} ↗
    </a>
  );
}

function CheckList({
  title,
  checks,
  mismatches,
}: {
  title: string;
  checks: Array<{ id: string; ok: boolean; message: string; expected?: string; actual?: string }>;
  mismatches: Array<{ id: string; ok: boolean; message: string; expected?: string; actual?: string }>;
}) {
  return (
    <div className="panel space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="space-y-2">
        {checks.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded border border-[var(--border)] p-2 text-sm"
          >
            <div>
              <Badge tone={c.ok ? "safe" : "blocked"}>{c.ok ? "PASS" : "FAIL"}</Badge>
              <span className="ml-2 font-mono text-xs text-[var(--muted)]">{c.id}</span>
              <p className="mt-1 text-[var(--muted)]">{c.message}</p>
              {c.expected != null && c.actual != null && !c.ok ? (
                <p className="text-xs text-[var(--danger)]">
                  expected {c.expected} · actual {c.actual}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {mismatches.length > 0 ? (
        <p className="text-xs text-[var(--danger)]">{mismatches.length} mismatch(es)</p>
      ) : (
        <p className="text-xs text-[var(--muted)]">All checks passed</p>
      )}
    </div>
  );
}

const APP_PAGES = [
  { href: "/", label: "Dashboard", note: "Mission, PnL, evidence, Binance" },
  { href: "/trades", label: "Trades", note: "Open/closed trades projection" },
  { href: "/ai-status", label: "AI Status", note: "Trace, journal, safety events" },
  { href: "/reports", label: "Reports", note: "Projection stats + legacy briefing" },
  { href: "/operator", label: "Operator", note: "Kill switch, risk mode" },
  { href: "/settings", label: "Settings", note: "Binance, env safety" },
] as const;

const API_LINKS = [
  { href: "/api/core/projections/bundle", label: "Projection bundle" },
  { href: "/api/core/ui-consistency", label: "UI consistency" },
  { href: "/api/core/projection-parity", label: "Projection parity" },
  { href: "/api/core/health", label: "Core health" },
  { href: "/api/core/projections/mission", label: "Mission projection" },
  { href: "/api/core/projections/trades", label: "Trades projection" },
  { href: "/api/core/projections/pnl", label: "PnL projection" },
  { href: "/api/core/projections/evidence", label: "Evidence projection" },
  { href: "/api/core/projections/risk", label: "Risk projection" },
] as const;

export default function CoreMonitorPage() {
  const {
    mission,
    pnl,
    evidence,
    trades,
    risk,
    health,
    loading: bundleLoading,
    error: bundleError,
    reload: reloadBundle,
  } = useProjectionBundle();
  const consistency = useApi<UiConsistencyReport>("/api/core/ui-consistency");
  const parity = useApi<ProjectionParityReport>("/api/core/projection-parity");
  const coreHealth = useApi<CoreHealthReport>("/api/core/health");

  const loading =
    bundleLoading || consistency.loading || parity.loading || coreHealth.loading;
  const error =
    bundleError ?? consistency.error ?? parity.error ?? coreHealth.error;

  const pending = LoadingOrError({
    loading,
    error,
    onRetry: () => {
      reloadBundle();
      void consistency.reload();
      void parity.reload();
      void coreHealth.reload();
    },
  });
  if (pending) return pending;

  const latestTradeId =
    trades.open[0]?.tradeId ?? trades.closed[0]?.tradeId ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Core Monitor</h2>
          <p className="text-sm text-[var(--muted)]">
            Projection health · consistency · parity · quick navigation
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            reloadBundle();
            void consistency.reload();
            void parity.reload();
            void coreHealth.reload();
          }}
        >
          Refresh
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">System status</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Core health" value={health?.status ?? coreHealth.data?.status ?? "—"} />
          <StatCard label="UI consistency" value={consistency.data?.status ?? "—"} />
          <StatCard label="Projection parity" value={parity.data?.status ?? "—"} />
          <StatCard label="Live locked" value={risk.liveLocked ? "true" : "false"} />
          <StatCard label="Equity" value={`$${mission.currentEquity.toLocaleString()}`} />
          <StatCard label="Net PnL" value={`$${pnl.totalNetPnl.toFixed(2)}`} />
          <StatCard
            label="Evidence"
            value={`${evidence.valid}/${evidence.required}`}
          />
          <StatCard
            label="Trades"
            value={`${trades.open.length} open / ${trades.closed.length} closed`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(consistency.data?.status ?? "OK")}>
            UI {consistency.data?.status ?? "—"}
          </Badge>
          <Badge tone={statusTone(parity.data?.status ?? "OK")}>
            Parity {parity.data?.status ?? "—"}
          </Badge>
          <Badge tone={statusTone(health?.status ?? "OK")}>
            Health {health?.status ?? "—"}
          </Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">App pages</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APP_PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="panel block transition hover:border-[var(--accent)]"
            >
              <p className="font-semibold text-[var(--accent)]">{p.label}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{p.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Core APIs (open JSON)</h3>
        <div className="flex flex-wrap gap-2">
          {API_LINKS.map((a) => (
            <ApiLink key={a.href} href={a.href} label={a.label} />
          ))}
          {latestTradeId ? (
            <ApiLink
              href={`/api/core/trace/${encodeURIComponent(latestTradeId)}`}
              label={`Trace ${latestTradeId}`}
            />
          ) : null}
        </div>
      </section>

      {consistency.data ? (
        <CheckList
          title="UI consistency checks"
          checks={consistency.data.checks}
          mismatches={consistency.data.mismatches}
        />
      ) : null}

      {parity.data ? (
        <CheckList
          title="Projection parity checks (bundle vs legacy)"
          checks={parity.data.checks}
          mismatches={parity.data.mismatches}
        />
      ) : null}

      {coreHealth.data?.blockingIssues?.length ? (
        <div className="panel space-y-2">
          <h3 className="font-semibold">Core health blockers</h3>
          <ul className="space-y-1 text-sm text-[var(--danger)]">
            {coreHealth.data.blockingIssues.map((i) => (
              <li key={i.code}>
                <span className="font-mono">{i.code}</span> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        Last consistency: {consistency.data?.lastCheckedAt ?? "—"} · parity:{" "}
        {parity.data?.lastCheckedAt ?? "—"}
      </p>
    </div>
  );
}

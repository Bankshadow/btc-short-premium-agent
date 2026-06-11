"use client";

import Link from "next/link";
import { Badge, useApi } from "@/components/use-api";
import { MetricCard, PageHeader, SafetyLabelsBar, SectionCard } from "@/components/ui";
import { useUiProjectionData } from "@/components/use-projection-bundle";
import type { AggregatedCoreHealthWarning } from "@/lib/core/health-warning-aggregate";
import type { CoreHealthReport } from "@/lib/core/core-health";
import { getDefaultCoreHealth } from "@/lib/core/projection-defaults";
import type { ProjectionParityReport } from "@/lib/core/projection-parity";
import type { UiConsistencyReport } from "@/lib/core/ui-consistency-check";
import {
  staleTradeBannerText,
  staleTradeRequiredAction,
} from "@/lib/core/stale-trade-display";
import { coalesceUiProjection, type UiProjectionData } from "@/lib/core/ui-projection-data";

function statusTone(status: string): "safe" | "blocked" | "wait" {
  if (status === "OK") return "safe";
  if (status === "WARNING" || status === "TIMEOUT_FIXED") return "wait";
  return "blocked";
}

function consistencyLabel(report: UiConsistencyReport | null): string {
  if (!report) return "—";
  if (report.timedOut) return "TIMEOUT_FIXED";
  return report.status;
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
  checks: Array<{
    id: string;
    ok: boolean;
    message: string;
    expected?: string;
    actual?: string;
    skipped?: boolean;
  }>;
  mismatches: Array<{
    id: string;
    ok: boolean;
    message: string;
    expected?: string;
    actual?: string;
  }>;
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
              <Badge tone={c.skipped ? "wait" : c.ok ? "safe" : "blocked"}>
                {c.skipped ? "SKIP" : c.ok ? "PASS" : "FAIL"}
              </Badge>
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
        <p className="text-xs text-[var(--muted)]">All active checks passed</p>
      )}
    </div>
  );
}

function WarningAggregateList({ warnings }: { warnings: AggregatedCoreHealthWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="panel space-y-2">
      <h3 className="font-semibold">Health warnings (aggregated)</h3>
      <ul className="space-y-2 text-sm">
        {warnings.map((w) => (
          <li key={w.code} className="rounded border border-[var(--border)] p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={w.severity === "BLOCK" ? "blocked" : "wait"}>{w.severity}</Badge>
              <span className="font-mono text-xs">{w.code}</span>
              <span className="text-[var(--muted)]">×{w.count}</span>
            </div>
            <p className="mt-1">{w.message}</p>
            {w.affectedTradeIds.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Trades: {w.affectedTradeIds.slice(0, 5).join(", ")}
                {w.affectedTradeIds.length > 5
                  ? ` (+${w.affectedTradeIds.length - 5} more)`
                  : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
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

const ZERO_CONSISTENCY: UiConsistencyReport = {
  status: "WARNING",
  checks: [],
  mismatches: [],
  skippedChecks: [],
  lastCheckedAt: new Date().toISOString(),
  browserDomChecksAvailable: false,
  note: "This endpoint validates projection consistency, not rendered DOM values.",
};

const ZERO_PARITY: ProjectionParityReport = {
  status: "WARNING",
  eventCount: 0,
  checkedSections: [],
  parityIssues: [],
  skippedChecks: [],
  checks: [],
  mismatches: [],
  lastCheckedAt: new Date().toISOString(),
};

export function CoreClient({ initialUi }: { initialUi: UiProjectionData }) {
  const ctx = useUiProjectionData();
  const ui = coalesceUiProjection(initialUi, ctx);
  const consistency = useApi<UiConsistencyReport>("/api/core/ui-consistency", 0, {
    fallback: ZERO_CONSISTENCY,
  });
  const parity = useApi<ProjectionParityReport>("/api/core/projection-parity", 0, {
    fallback: ZERO_PARITY,
  });
  const coreHealth = useApi<CoreHealthReport>("/api/core/health", 0, {
    fallback: getDefaultCoreHealth(),
  });

  const healthStatus = ui.health.status;
  const warningCount =
    ui.health.rawWarningCount > 0
      ? ui.health.rawWarningCount
      : (ui.health.warnings?.reduce((sum, w) => sum + (w.count ?? 1), 0) ?? 0);
  const staleWarnings = ui.trades.staleOpenWarnings;
  const latestTradeId =
    ui.trades.open[0]?.tradeId ?? ui.trades.closed[0]?.tradeId ?? null;

  const nextAction =
    healthStatus === "OK" &&
    consistency.data?.status === "OK" &&
    parity.data?.status === "OK" &&
    staleWarnings.length === 0
      ? "Core engine checks passed — monitor lifecycle and evidence progress."
      : "Fix pending PnL and lifecycle gaps before CORE_ENGINE_STABLE.";

  return (
    <div className="ui-dashboard-grid">
      <PageHeader
        title="Core Monitor"
        description="Technical diagnostics — health, consistency, parity, APIs"
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              ui.reload();
              void consistency.reload();
              void parity.reload();
              void coreHealth.reload();
            }}
          >
            Refresh
          </button>
        }
      />
      <SafetyLabelsBar />

      <section
        className="rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-xs text-[var(--muted)]"
        aria-label="Projection source diagnostic"
      >
        Projection source: {ui.source}
        {" · "}
        trades={ui.mission.openTrades} open / {ui.mission.closedTrades} closed
        {" · "}
        health={healthStatus}
      </section>

      <SectionCard title="Next action" tone="warning">
        <p className="text-sm text-[var(--muted)]">{nextAction}</p>
      </SectionCard>

      <SectionCard title="System status">
        <div className="ui-dashboard-metrics sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Core health" value={healthStatus} />
          <MetricCard label="UI consistency" value={consistencyLabel(consistency.data)} />
          <MetricCard label="Projection parity" value={parity.data?.status ?? "—"} />
          <MetricCard label="Live locked" value={ui.risk.liveLocked ? "true" : "false"} />
          <MetricCard label="Equity" value={`$${ui.mission.currentEquity.toLocaleString()}`} />
          <MetricCard label="Net PnL" value={`$${ui.mission.netPnl.toFixed(2)}`} />
          <MetricCard label="Evidence" value={`${ui.evidence.valid}/${ui.evidence.required}`} />
          <MetricCard
            label="Trades"
            value={`${ui.mission.openTrades} open / ${ui.mission.closedTrades} closed`}
          />
          <MetricCard label="Health warnings" value={String(warningCount)} />
        </div>
        {ui.isFallback && !ui.loading ? (
          <p className="text-xs text-[var(--danger)]">Projection fallback active — bundle values may be zero-state.</p>
        ) : null}
        {consistency.data?.note ? (
          <p className="text-xs text-[var(--muted)]">
            {consistency.data.note} UI consistency checks projections, not rendered DOM.
          </p>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            UI consistency checks projections, not rendered DOM.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(consistencyLabel(consistency.data))}>
            UI {consistencyLabel(consistency.data)}
          </Badge>
          <Badge tone={statusTone(parity.data?.status ?? "OK")}>
            Parity {parity.data?.status ?? "—"}
          </Badge>
          <Badge tone={statusTone(healthStatus)}>
            Health {healthStatus}
          </Badge>
        </div>
        {(consistency.error || parity.error || coreHealth.error) && (
          <p className="text-xs text-[var(--danger)]">
            API note: {consistency.error ?? parity.error ?? coreHealth.error} — showing cached/zero-state
            data.
          </p>
        )}
      </SectionCard>

      {staleWarnings.length > 0 ? (
        <SectionCard title="Stale trade manual repair" addon="WARNING" tone="warning">
          <p className="text-sm text-[var(--muted)]">{staleTradeBannerText(staleWarnings.length)}</p>
          <ul className="mt-3 space-y-3 text-sm">
            {staleWarnings.map((w) => (
              <li key={w.tradeId} className="rounded border border-[var(--border)] p-3">
                <p className="font-mono text-xs">{w.tradeId}</p>
                <p className="mt-1">
                  Projected status: <strong>{w.projectedStatus}</strong>
                </p>
                {w.recommendation ? (
                  <p className="text-xs text-[var(--muted)]">Recommendation: {w.recommendation}</p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Required action: {staleTradeRequiredAction(w)}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

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

      {consistency.data && consistency.data.checks.length > 0 ? (
        <CheckList
          title="UI consistency checks"
          checks={consistency.data.checks}
          mismatches={consistency.data.mismatches}
        />
      ) : null}

      {parity.data && parity.data.checks.length > 0 ? (
        <CheckList
          title="Projection parity checks (bundle vs legacy)"
          checks={parity.data.checks}
          mismatches={parity.data.mismatches}
        />
      ) : null}

      {ui.health.blockingIssues?.length ? (
        <div className="panel space-y-2">
          <h3 className="font-semibold">Core health blockers</h3>
          <ul className="space-y-1 text-sm text-[var(--danger)]">
            {ui.health.blockingIssues.map((i) => (
              <li key={i.code}>
                <span className="font-mono">{i.code}</span> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <WarningAggregateList warnings={ui.health.warnings ?? []} />

      <p className="text-xs text-[var(--muted)]">
        Last consistency: {consistency.data?.lastCheckedAt ?? "—"} · parity:{" "}
        {parity.data?.lastCheckedAt ?? "—"} · health warnings: {warningCount}
      </p>
    </div>
  );
}

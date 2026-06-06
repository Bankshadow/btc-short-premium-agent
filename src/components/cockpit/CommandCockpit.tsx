"use client";

import Link from "next/link";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { DeskBackboneRecord } from "@/lib/data-backbone/types";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { CommandCenterStatus } from "@/lib/command-center/types";
import { AUTOPILOT_MODE_LABELS } from "@/lib/autopilot/config";
import StatusBadge from "@/components/ux/StatusBadge";
import DeskEmptyState from "@/components/desk/DeskEmptyState";
import RecentNotificationsStrip from "./RecentNotificationsStrip";
import {
  ACTIONS_EMPTY,
  COCKPIT_EMPTY,
  LEARNING_EMPTY,
  LIVE_READINESS_EMPTY,
  PORTFOLIO_EMPTY,
  VERDICT_EMPTY,
} from "@/lib/ux/empty-states";
import {
  COCKPIT_TAGLINE,
  formatDeskStatusLabel,
  formatLearningProgress,
  formatLiveReadinessLabel,
  formatRecommendedAction,
  formatRiskBlocker,
  formatVerdictLabel,
} from "@/lib/ux/operator-copy";
import {
  mapDeskStatusToBadge,
  mapLiveReadinessToBadge,
  mapVerdictToBadge,
} from "@/lib/ux/status-badges";
import type { PolicyResult } from "@/lib/policy-engine/types";

function verdictTone(v: string): string {
  if (v === "TRADE") return "text-emerald-300";
  if (v === "SKIP") return "text-rose-300";
  if (v === "WAIT") return "text-amber-300";
  return "text-zinc-400";
}

type Props = {
  data: AnalyzeApiResponse | null;
  autopilot: AutopilotRunResult | null;
  backbone?: DeskBackboneRecord | null;
  actions: OperatorAction[];
  deskStatus: CommandCenterStatus;
  deskStatusReason: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  autopilotMode: string;
  running: boolean;
  workerStatus?: string | null;
  workerFailed?: number;
  onRunCycle: () => void;
  onRunAnalyze: () => void;
  analyzeAllowed?: boolean;
  policyResult?: PolicyResult | null;
  liveReadinessStatus?: string | null;
  liveReadinessReady?: boolean;
  liveReadinessBlockers?: string[];
};

export default function CommandCockpit({
  data,
  autopilot,
  backbone,
  actions,
  deskStatus,
  deskStatusReason,
  lastRunAt,
  nextRunAt,
  autopilotMode,
  running,
  workerStatus,
  workerFailed,
  onRunCycle,
  onRunAnalyze,
  analyzeAllowed = true,
  policyResult = null,
  liveReadinessStatus = null,
  liveReadinessReady = false,
  liveReadinessBlockers = [],
}: Props) {
  const committee = data?.tradingDesk?.weightedCommittee;
  const verdict =
    committee?.weightedVerdict ??
    data?.step5_verdict?.recommendation ??
    autopilot?.finalVerdict ??
    "NONE";
  const confidence =
    data?.step5_verdict?.confidence ?? committee?.tradeScore ?? autopilot?.confidence ?? 0;
  const reasons =
    committee?.reasonTrail?.slice(0, 3) ??
    data?.tradingDesk?.committee?.topReasons?.slice(0, 3) ??
    [];
  const topBlocker =
    autopilot?.blockers[0] ??
    (data?.tradingDesk?.committee?.riskVeto
      ? "Risk manager veto — review before any trade."
      : null);
  const primary = actions[0];
  const portfolio = backbone?.portfolio
    ? {
        paperPnlPct: backbone.portfolio.paperPnlPct,
        openPaperTrades: backbone.portfolio.openPaperTrades,
        sampleSize: backbone.portfolio.sampleSize,
        drawdownPct: backbone.portfolio.drawdownPct,
        exposureUsd: backbone.portfolio.exposureUsd,
      }
    : autopilot?.portfolioSnapshot;
  const learning = backbone?.learning ?? autopilot?.learningStatus;
  const hasRun = Boolean(lastRunAt || autopilot || data);
  const verdictBadge = mapVerdictToBadge(String(verdict));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100">Desk Cockpit</h1>
            <StatusBadge status={mapDeskStatusToBadge(deskStatus)} />
            <StatusBadge status="LIVE_LOCKED" />
            <StatusBadge status="PAPER" />
            {running && <StatusBadge status="RUNNING" />}
            {actions.length > 0 && <StatusBadge status="NEEDS_ACTION" />}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{COCKPIT_TAGLINE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              running ||
              !analyzeAllowed ||
              (policyResult?.decision === "BLOCK")
            }
            onClick={onRunAnalyze}
            className="rounded-lg bg-amber-700/80 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-600 disabled:opacity-50"
          >
            Run desk cycle
          </button>
          <button
            type="button"
            disabled={running}
            onClick={onRunCycle}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh
          </button>
          <Link
            href="/autopilot"
            className="rounded-lg border border-cyan-800/50 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-950/40"
          >
            Autopilot
          </Link>
          <Link
            href="/notifications"
            className="rounded-lg border border-amber-800/50 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-950/40"
          >
            Alerts
          </Link>
        </div>
      </div>

      {!analyzeAllowed && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">
          Desk analysis requires TRADER, RISK_MANAGER, ADMIN, or OWNER role. VIEWER can
          review reports only.
        </p>
      )}

      {policyResult && policyResult.decision !== "ALLOW" && (
        <p className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200/90">
          Policy {policyResult.decision}: {policyResult.blockers[0] ?? policyResult.reasons[0]}
          {" · "}
          <a href="/policies" className="underline">
            View policies
          </a>
        </p>
      )}

      {!hasRun && (
        <DeskEmptyState
          title={COCKPIT_EMPTY.title}
          missing={COCKPIT_EMPTY.missing}
          why={COCKPIT_EMPTY.why}
          actionLabel={COCKPIT_EMPTY.actionLabel}
          onAction={analyzeAllowed ? onRunAnalyze : undefined}
        />
      )}

      {(workerStatus === "FAILED" || workerStatus === "BLOCKED" || (workerFailed ?? 0) > 0) && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          Background worker needs attention — open{" "}
          <Link href="/worker" className="underline">
            Worker
          </Link>
          {(workerFailed ?? 0) > 0 ? ` (${workerFailed} failed job(s))` : ""}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Desk status
            </p>
            <StatusBadge status={mapDeskStatusToBadge(deskStatus)} />
          </div>
          <p className="mt-2 text-sm font-medium text-zinc-200">
            {formatDeskStatusLabel(deskStatus)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{deskStatusReason}</p>
          <p className="mt-2 text-[10px] text-zinc-600">
            Last {lastRunAt ? new Date(lastRunAt).toLocaleString() : "—"}
            {nextRunAt ? ` · Next ${new Date(nextRunAt).toLocaleTimeString()}` : ""}
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              AI verdict
            </p>
            {verdictBadge && <StatusBadge status={verdictBadge} />}
          </div>
          {String(verdict).toUpperCase() === "NONE" && !data ? (
            <div className="mt-2">
              <p className="text-sm text-zinc-400">{VERDICT_EMPTY.missing}</p>
              <p className="mt-1 text-xs text-zinc-600">{VERDICT_EMPTY.why}</p>
            </div>
          ) : (
            <>
              <p className={`mt-2 text-xl font-bold ${verdictTone(String(verdict))}`}>
                {formatVerdictLabel(String(verdict))}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Confidence {confidence}%</p>
              <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
                {reasons.length > 0 ? (
                  reasons.map((r) => <li key={r}>· {r}</li>)
                ) : (
                  <li>Top reasons appear after a desk cycle.</li>
                )}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 ring-1 ring-indigo-900/30">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300/70">
              Recommended action
            </p>
            {primary && <StatusBadge status="NEEDS_ACTION" />}
          </div>
          <p className="mt-2 text-sm font-semibold text-indigo-100">
            {formatRecommendedAction(
              primary?.title,
              "Run your first desk cycle",
            )}
          </p>
          <p className="mt-1 text-xs text-indigo-200/70">
            {primary?.description ??
              "The AI will tell you what matters once it has reviewed the market."}
          </p>
          <Link href="/actions" className="mt-2 inline-block text-[11px] text-indigo-400 hover:underline">
            Action queue →
          </Link>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Risk blocker
            </p>
            {topBlocker && <StatusBadge status="BLOCKED" />}
            {!topBlocker && <StatusBadge status="SAFE" />}
          </div>
          <p className="mt-2 text-sm text-zinc-300">
            {topBlocker ? formatRiskBlocker(topBlocker) : "No hard blockers on the last cycle."}
          </p>
        </section>

        <section className="rounded-xl border border-teal-900/40 bg-teal-950/15 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/70">
              Portfolio
            </p>
            <StatusBadge status="PAPER" />
          </div>
          {(portfolio?.openPaperTrades ?? 0) === 0 && (portfolio?.sampleSize ?? 0) === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">{PORTFOLIO_EMPTY.missing}</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-300">
              <div>
                <span className="text-zinc-500">Paper PnL</span>
                <p className="font-semibold">{portfolio?.paperPnlPct ?? 0}%</p>
              </div>
              <div>
                <span className="text-zinc-500">Open trades</span>
                <p className="font-semibold">{portfolio?.openPaperTrades ?? 0}</p>
              </div>
              <div>
                <span className="text-zinc-500">Sample size</span>
                <p className="font-semibold">{portfolio?.sampleSize ?? 0}</p>
              </div>
              <div>
                <span className="text-zinc-500">Exposure</span>
                <p className="font-semibold">${portfolio?.exposureUsd?.toLocaleString() ?? 0}</p>
              </div>
            </div>
          )}
          <Link href="/portfolio" className="mt-2 inline-block text-[11px] text-teal-400 hover:underline">
            Portfolio →
          </Link>
        </section>

        <section className="rounded-xl border border-cyan-900/40 bg-cyan-950/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/70">
            Autopilot
          </p>
          <p className="mt-2 text-sm font-semibold text-cyan-100">
            {AUTOPILOT_MODE_LABELS[autopilotMode as keyof typeof AUTOPILOT_MODE_LABELS] ??
              autopilotMode}
          </p>
          <p className="mt-1 text-xs text-cyan-200/70">
            {autopilot?.briefing ?? "Paper and shadow trades run automatically when enabled."}
          </p>
        </section>

        <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/70">
              Live readiness
            </p>
            {liveReadinessStatus ? (
              <StatusBadge status={mapLiveReadinessToBadge(liveReadinessStatus)} />
            ) : (
              <StatusBadge status="CAUTION" />
            )}
          </div>
          {liveReadinessStatus ? (
            <>
              <p className="mt-2 text-sm font-semibold text-emerald-100">
                {formatLiveReadinessLabel({
                  status: liveReadinessStatus,
                  readyForPilot: liveReadinessReady,
                  blockers: liveReadinessBlockers,
                })}
              </p>
              <p className="mt-1 text-xs text-emerald-200/70">
                {liveReadinessReady
                  ? "Small live perp pilot may proceed with human approval."
                  : "Live remains locked until readiness criteria pass."}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-400">{LIVE_READINESS_EMPTY.missing}</p>
              <p className="mt-1 text-xs text-zinc-600">{LIVE_READINESS_EMPTY.why}</p>
            </>
          )}
          <Link
            href="/live-readiness"
            className="mt-2 inline-block text-[11px] text-emerald-400 hover:underline"
          >
            Live readiness →
          </Link>
        </section>

        <section className="rounded-xl border border-violet-900/40 bg-violet-950/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/70">
            Learning progress
          </p>
          <p className="mt-2 text-sm font-semibold text-violet-100">
            {formatLearningProgress({
              label: learning?.label,
              resolved: learning?.resolvedOutcomesCount,
              target: learning?.minRequiredSampleSize,
            })}
          </p>
          {(learning?.resolvedOutcomesCount ?? 0) === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">{LEARNING_EMPTY.why}</p>
          ) : (
            <p className="mt-1 text-xs text-violet-200/70">{learning?.detail}</p>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            {learning?.resolvedOutcomesCount ?? 0} resolved · target{" "}
            {learning?.minRequiredSampleSize ?? 12}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Action queue</h2>
          <Link href="/actions" className="text-xs text-cyan-400 hover:underline">
            View all →
          </Link>
        </div>
        {actions.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-400">{ACTIONS_EMPTY.missing}</p>
            <p className="mt-1 text-xs text-zinc-600">{ACTIONS_EMPTY.why}</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {actions.slice(0, 5).map((a) => (
              <li
                key={a.actionId}
                className="flex flex-wrap items-start gap-2 rounded border border-zinc-800 px-3 py-2 text-xs"
              >
                <StatusBadge
                  status={a.priority === "CRITICAL" ? "BLOCKED" : "NEEDS_ACTION"}
                />
                <span className="font-medium text-zinc-200">{a.title}</span>
                <span className="text-zinc-500">{a.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentNotificationsStrip />
    </div>
  );
}

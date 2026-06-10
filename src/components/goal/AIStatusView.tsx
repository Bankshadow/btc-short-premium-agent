"use client";

import Link from "next/link";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import { EngineEventFeed } from "./EngineEventFeed";
import { useMissionSnapshot } from "./use-mission-snapshot";
import { useAnalysisState } from "@/hooks/useAnalysisState";
import { listAnalysisPipelineStages } from "@/lib/analysis-engine/analysis-engine-registry";

const AI_STATE_COPY: Record<string, string> = {
  IDLE: "Idle",
  ANALYZING: "Analyzing",
  MONITORING: "Monitoring",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
};

const PIPELINE_STAGES = listAnalysisPipelineStages();

export default function AIStatusView() {
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const analysis = useAnalysisState(8000);

  const aiState = analysis.ui?.aiState ?? m.aiStatus.state;
  const activeStep =
    aiState === "ANALYZING"
      ? "playbook_analyzer"
      : aiState === "BLOCKED"
        ? "validation_kill_switch"
        : aiState === "MONITORING"
          ? "execution_readiness"
          : "final_result";

  const blockers = [
    ...(analysis.ui?.blockers ?? []),
    ...(m.risk.blocker ? [m.risk.blocker] : []),
  ].filter((b, i, arr) => b && arr.indexOf(b) === i);

  return (
    <GoalShell
      title="AI Status"
      subtitle="Engine state, pipeline step, events, blockers, and permissions."
      activePath="/ai-status"
      missionSnapshot={m}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void refresh(true);
            void analysis.refresh(true);
          }}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <GoalErrorBanner
        error={error ?? analysis.error}
        degraded={degraded}
        warnings={warnings}
        snapshot={m}
      />

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Binance testnet
        </h2>
        <p
          className={`mt-2 font-mono text-xl ${
            m.binanceTestnet.status === "CONNECTED" ? "text-emerald-300" : "text-amber-300"
          }`}
        >
          {m.binanceTestnet.status}
        </p>
        <p className="mt-1 text-sm text-zinc-400">{m.binanceTestnet.reason}</p>
        <p className="mt-2 text-xs text-zinc-500">{m.binanceTestnet.recommendation}</p>
        <dl className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Testnet enabled</dt>
            <dd>{m.binanceTestnet.testnetEnabled ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Live trading</dt>
            <dd className="text-amber-300">Locked</dd>
          </div>
          <div>
            <dt className="text-zinc-500">API key / secret</dt>
            <dd>
              {m.binanceTestnet.apiKeyPresent ? "key ✓" : "key ✗"} ·{" "}
              {m.binanceTestnet.apiSecretPresent ? "secret ✓" : "secret ✗"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Proxy</dt>
            <dd>
              {m.binanceTestnet.proxyEnabled
                ? `${m.binanceTestnet.proxyProvider ?? "enabled"}${m.binanceTestnet.proxyUrlConfigured ? "" : " (URL missing)"}`
                : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Base URL</dt>
            <dd className="font-mono text-zinc-300">{m.binanceTestnet.baseUrl || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Last checked</dt>
            <dd>
              {m.binanceTestnet.lastCheckedAt
                ? new Date(m.binanceTestnet.lastCheckedAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
        <Link
          href="/settings"
          className="mt-3 inline-block text-xs text-emerald-300 hover:underline"
        >
          Testnet settings →
        </Link>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Engine state
        </h2>
        <p className="mt-2 font-mono text-3xl text-zinc-50">
          {AI_STATE_COPY[aiState] ?? aiState}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {analysis.ui?.reportSummary ?? m.aiStatus.lastAction}
        </p>
        <dl className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Verdict</dt>
            <dd>{analysis.ui?.finalVerdict ?? m.lastVerdict ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next action</dt>
            <dd>{analysis.ui?.nextAction ?? m.aiStatus.nextAction}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Run ID</dt>
            <dd className="font-mono text-zinc-200">{analysis.ui?.runId?.slice(0, 24) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Decision log</dt>
            <dd className="font-mono text-zinc-200">
              {analysis.ui?.decisionLogId ? (
                <Link
                  href={`/trades/${analysis.ui.decisionLogId}`}
                  className="text-emerald-300 hover:underline"
                >
                  {analysis.ui.decisionLogId.slice(0, 20)}…
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Current step
        </h2>
        <ol className="mt-3 space-y-1.5">
          {PIPELINE_STAGES.map((stage) => {
            const active = stage.id === activeStep;
            const done =
              PIPELINE_STAGES.findIndex((s) => s.id === stage.id) <
              PIPELINE_STAGES.findIndex((s) => s.id === activeStep);
            return (
              <li
                key={stage.id}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${
                  active
                    ? "border-violet-700/50 bg-violet-950/30 text-violet-200"
                    : done
                      ? "border-emerald-900/30 text-emerald-400/80"
                      : "border-zinc-800/60 text-zinc-500"
                }`}
              >
                <span className="w-5 font-mono">{stage.order}</span>
                <span>{stage.label}</span>
                {active && (
                  <span className="ml-auto text-[10px] uppercase">active</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <EngineEventFeed
        events={analysis.events.slice(0, 5)}
        limit={5}
        title="Recent events"
        compact
      />

      <section
        className={`rounded-xl border p-5 ${
          blockers.length > 0
            ? "border-rose-900/50 bg-rose-950/20"
            : "border-zinc-800/80 bg-zinc-950/60"
        }`}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Blockers
        </h2>
        {blockers.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-300/90">No blockers — engine clear.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm text-rose-200/90">
            {blockers.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        )}
        {blockers.length > 0 && (
          <Link
            href="/advanced/engine-health"
            className="mt-3 inline-block text-xs text-emerald-300 hover:underline"
          >
            Engine health details →
          </Link>
        )}
      </section>

      <section
        className={`rounded-xl border p-5 ${
          analysis.ui?.humanActionRequired || m.pendingTestnetPreview
            ? "border-amber-900/50 bg-amber-950/20"
            : "border-zinc-800/80 bg-zinc-950/60"
        }`}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Permission needed
        </h2>
        {analysis.ui?.humanActionRequired || m.pendingTestnetPreview ? (
          <>
            <p className="mt-2 text-sm text-amber-100">
              {m.pendingTestnetPreview
                ? `Testnet preview ${m.pendingTestnetPreview.symbol} ${m.pendingTestnetPreview.side} — double confirm on Dashboard.`
                : "Human approval required before the next trade action."}
            </p>
            <Link href="/" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
              Go to Dashboard →
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">No permission prompts pending.</p>
        )}
      </section>
    </GoalShell>
  );
}


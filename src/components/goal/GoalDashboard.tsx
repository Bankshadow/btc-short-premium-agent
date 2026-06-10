"use client";

import { useState } from "react";
import Link from "next/link";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import OneButtonAiHero from "./OneButtonAiHero";
import TestnetTradeModal from "./TestnetTradeModal";
import PermissionPrompt from "@/components/agent-os/PermissionPrompt";
import { EngineEventAlertBanner } from "./EngineEventFeed";
import EngineStatusBanner from "./EngineStatusBanner";
import { MissionControllerRiskBudgetBadge } from "@/components/mission-controller-risk-budget/MissionControllerRiskBudgetPanel";
import { AlwaysOnOperatorLayerBadge } from "@/components/always-on-operator-layer/AlwaysOnOperatorLayerPanel";
import { MicroLiveReadinessReviewBadge } from "@/components/micro-live-readiness-review/MicroLiveReadinessReviewPanel";
import { useMissionSnapshot } from "./use-mission-snapshot";
import { useAnalysisState } from "@/hooks/useAnalysisState";
import { useEngineEvents } from "@/hooks/useEngineEvents";
import { useAgentOs } from "@/hooks/useAgentOs";
import { loadAgentOsSettings } from "@/lib/agent-os/settings-store";
import { useHomeDashboardMotion } from "@/hooks/useHomePageMotion";
import type { EngineEvent } from "@/lib/engine-event-bus/types";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const AI_STATE_COPY: Record<string, string> = {
  IDLE: "Idle",
  ANALYZING: "Analyzing",
  MONITORING: "Monitoring",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
};

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "alert" | "good";
}) {
  const border =
    tone === "alert"
      ? "border-rose-900/50"
      : tone === "good"
        ? "border-emerald-900/50"
        : "border-zinc-800/80";
  return (
    <section data-home-panel className={`rounded-xl border ${border} bg-zinc-950/60 p-4`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function GoalDashboard() {
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const analysis = useAnalysisState(12000);
  const { contentRef, progressRef } = useHomeDashboardMotion(m.progressPct);
  const [alertEvent, setAlertEvent] = useState<EngineEvent | null>(null);

  useEngineEvents({
    useSse: true,
    pollMs: 0,
    onImportantEvent: (ev) => {
      setAlertEvent(ev);
      void refresh(true);
      void analysis.refresh(true);
    },
  });

  const [tradeModal, setTradeModal] = useState<{
    open: boolean;
    mode: "execute" | "close";
  }>({ open: false, mode: "execute" });

  const agentOsSettings = loadAgentOsSettings();
  const testnetConnected = m.binanceTestnet.status === "CONNECTED";

  const agentOs = useAgentOs({
    observeOnly: agentOsSettings.observeOnly || m.automation.paused,
    autopilotEnabled: m.automation.enabled,
    testnetConnected,
    automationEnabled: m.automation.enabled && !m.automation.paused,
    testnetAllowAllSafe: agentOsSettings.testnetAllowAllSafe,
    testnetAllowAllExplicitlyEnabled: agentOsSettings.testnetAllowAllExplicitlyEnabled,
    currentAction: m.aiStatus.lastAction,
    nextAction: analysis.ui?.nextAction ?? m.aiStatus.nextAction,
    goalProgressPct: m.progressPct,
    pendingAction: m.pendingTestnetPreview && !m.pendingTestnetPreview.blocked
      ? "EXECUTE_TESTNET_ORDER"
      : null,
    linkedDecisionId: analysis.ui?.decisionLogId ?? m.latestDecisionLogId,
  });

  const openTestnetModal = (mode: "execute" | "close") => {
    const action =
      mode === "close" ? ("CLOSE_TESTNET_POSITION" as const) : ("EXECUTE_TESTNET_ORDER" as const);
    const perm = agentOs.checkPermission(action);
    if (perm.allowed) {
      setTradeModal({ open: true, mode });
      return;
    }
    if (!perm.requiresPermission) return;
    agentOs.requestPermission(
      action,
      {
        action,
        title: mode === "close" ? "Close testnet position" : "Execute testnet order",
        why:
          mode === "close"
            ? "AI monitor suggests closing the open testnet position."
            : "Central engine created a testnet preview — double confirm required.",
        risk: "Testnet capital only — live remains locked.",
        expectedResult:
          mode === "close"
            ? "Position closed and PnL recorded."
            : "Order placed on Binance testnet after your confirmation.",
        linkedDecisionId: analysis.ui?.decisionLogId ?? m.latestDecisionLogId,
        sessionSafe: true,
      },
      () => setTradeModal({ open: true, mode }),
    );
  };

  const aiState = analysis.ui?.aiState ?? m.aiStatus.state;
  const verdict = analysis.ui?.finalVerdict ?? m.lastVerdict;
  const nextAction = analysis.ui?.nextAction ?? m.aiStatus.nextAction;
  const humanRequired =
    analysis.ui?.humanActionRequired ?? m.aiStatus.humanActionRequired;
  const riskStatus = analysis.ui?.riskStatus ?? (m.risk.blocker ? "BLOCKED" : "SAFE");

  return (
    <GoalShell
      title="AI Profit Mission"
      subtitle="Simple mission control — analysis runs in the central engine. Advanced modules live under Advanced."
      activePath="/"
      enableMotion
      missionSnapshot={m}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void refresh(true);
            void analysis.refresh(true);
          }}
          className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          {busy ? "..." : "Refresh"}
        </button>
      }
    >
      <div ref={contentRef} className="flex flex-col gap-5">
        <GoalErrorBanner
          error={error ?? analysis.error}
          degraded={degraded}
          warnings={warnings}
          snapshot={m}
        />

        <EngineStatusBanner />

        <EngineEventAlertBanner event={alertEvent} />

        <PermissionPrompt
          request={
            agentOs.pendingPrompt ?? {
              action: "EXECUTE_TESTNET_ORDER",
              title: "Permission required",
              why: "",
              risk: "",
              expectedResult: "",
            }
          }
          open={agentOs.promptOpen}
          onDecision={agentOs.handlePermissionDecision}
          busy={false}
        />

        {/* Mission */}
        <Card title="Mission" tone="good">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Current equity</p>
              <p className="font-mono text-2xl text-zinc-50">{usd(m.currentEquity)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Target</p>
              <p className="font-mono text-xl text-zinc-200">{usd(m.targetCapital)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Progress</p>
              <p className="font-mono text-xl text-emerald-300">{m.progressPct}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Net PnL</p>
              <p className="font-mono text-xl text-zinc-100">{usd(m.netPnl)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              ref={progressRef}
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: "0%" }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <MissionControllerRiskBudgetBadge snapshot={m.missionControllerRiskBudget} />
            <AlwaysOnOperatorLayerBadge snapshot={m.alwaysOnOperatorLayer} />
            <MicroLiveReadinessReviewBadge review={m.microLiveReadinessReview} />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
            <span>Trades: {m.closedTrades}</span>
            <span>
              Win / loss: {m.wins} / {m.losses}
            </span>
            <span>Open: {m.openTrades}</span>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* AI State */}
          <Card title="AI State" tone={humanRequired ? "alert" : "default"}>
            <p className="font-mono text-2xl text-zinc-100">
              {AI_STATE_COPY[aiState] ?? aiState}
            </p>
            <dl className="mt-3 space-y-1.5 text-xs text-zinc-400">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Latest verdict</dt>
                <dd>{verdict ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Next action</dt>
                <dd>{nextAction}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Human needed</dt>
                <dd className={humanRequired ? "text-amber-300" : "text-emerald-300"}>
                  {humanRequired ? "Yes" : "No"}
                </dd>
              </div>
              {analysis.ui?.reportSummary && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-zinc-500">Engine</dt>
                  <dd>{analysis.ui.reportSummary}</dd>
                </div>
              )}
            </dl>
            <Link
              href="/ai-status"
              className="mt-3 inline-block text-xs text-emerald-300 hover:underline"
            >
              Full AI status →
            </Link>
          </Card>

          {/* Position */}
          <Card title="Position">
            {!m.currentPosition ? (
              <p className="text-sm text-zinc-500">No active position.</p>
            ) : (
              <div className="space-y-1.5 text-xs text-zinc-400">
                <p className="font-mono text-base text-zinc-100">
                  {m.currentPosition.summary}
                </p>
                <p>Unrealized: {usd(m.currentPosition.unrealizedPnlUsd)}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Link href="/trades" className="text-emerald-300 hover:underline">
                    View trades →
                  </Link>
                  {m.currentPosition.canCloseOnTestnet && (
                    <button
                      type="button"
                      onClick={() => openTestnetModal("close")}
                      className="text-amber-300 hover:underline"
                    >
                      Close on testnet →
                    </button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Latest Decision */}
        <Card title="Latest Decision">
          <div className="grid gap-3 sm:grid-cols-2 text-xs text-zinc-400">
            <div>
              <p className="text-zinc-500">Run ID</p>
              <p className="mt-0.5 font-mono text-zinc-200">
                {analysis.ui?.runId?.slice(0, 24) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Decision log</p>
              <p className="mt-0.5 font-mono text-zinc-200">
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
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Confidence</p>
              <p className="mt-0.5 text-zinc-200">
                {analysis.ui?.confidence != null ? `${analysis.ui.confidence}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Last cycle</p>
              <p className="mt-0.5 text-zinc-200">
                {m.lastCycleAt ? new Date(m.lastCycleAt).toLocaleString() : "Not yet"}
              </p>
            </div>
          </div>
          {m.pendingTestnetPreview && !m.pendingTestnetPreview.blocked && (
            <button
              type="button"
              onClick={() => openTestnetModal("execute")}
              className="mt-3 rounded-lg border border-cyan-800/60 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-950/40"
            >
              Review preview · {m.pendingTestnetPreview.symbol}{" "}
              {m.pendingTestnetPreview.side}
            </button>
          )}
        </Card>

        {/* Risk */}
        <Card title="Risk" tone={m.risk.blocker ? "alert" : "default"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <p className="text-zinc-500">Risk status</p>
              <p
                className={
                  riskStatus === "BLOCKED"
                    ? "text-rose-300"
                    : riskStatus === "CAUTION"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }
              >
                {riskStatus}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Live trading</p>
              <p className="text-emerald-300">Locked</p>
            </div>
            <div>
              <p className="text-zinc-500">Testnet</p>
              <p
                className={
                  m.binanceTestnet.status === "CONNECTED"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {m.binanceTestnet.status}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Blocker</p>
              <p className={m.risk.blocker ? "text-rose-300" : "text-emerald-300"}>
                {analysis.ui?.blockers[0] ?? m.risk.blocker ?? "None"}
              </p>
            </div>
          </div>
        </Card>

        {/* One Button */}
        <OneButtonAiHero
          onNeedsConfirm={(mode) => openTestnetModal(mode)}
          onAfterRun={() => {
            void refresh(true);
            void analysis.refresh(true);
          }}
        />

        <p className="text-center text-[10px] text-zinc-600">
          Practice money only. All analysis flows through the central engine — no auto live
          execution.
        </p>

        <TestnetTradeModal
          open={tradeModal.open}
          mode={tradeModal.mode}
          preview={m.pendingTestnetPreview}
          position={m.currentPosition}
          onClose={() => setTradeModal((s) => ({ ...s, open: false }))}
          onSuccess={() => {
            setTradeModal((s) => ({ ...s, open: false }));
            void refresh(true);
            void analysis.refresh(true);
          }}
        />
      </div>
    </GoalShell>
  );
}

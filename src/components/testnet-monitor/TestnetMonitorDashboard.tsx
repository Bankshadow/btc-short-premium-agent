"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import IncidentsV2Badge from "@/components/incidents-v2/IncidentsV2Badge";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { appendBinanceTestnetJournalClient } from "@/lib/exchange/binance/binance-testnet-journal";
import { buildDecisionLinkage } from "@/lib/testnet-monitor/decision-linkage";
import type {
  TestnetClosedTrade,
  TestnetDecisionLinkage,
  TestnetLearningQueueItem,
  TestnetMonitorSnapshot,
  TestnetOrder,
  TestnetPosition,
} from "@/lib/testnet-monitor/types";

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 ${className}`}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function durationLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export default function TestnetMonitorDashboard({
  activePath = "/testnet-monitor",
}: {
  activePath?: string;
}) {
  const [snapshot, setSnapshot] = useState<TestnetMonitorSnapshot | null>(null);
  const [learningQueue, setLearningQueue] = useState<TestnetLearningQueueItem[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [doubleConfirm, setDoubleConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((data: unknown) => {
    const payload = data as { snapshot?: TestnetMonitorSnapshot } & Partial<TestnetMonitorSnapshot>;
    const next = (payload.snapshot ?? payload) as TestnetMonitorSnapshot;
    setSnapshot(next);
    setLearningQueue(next.learningQueue ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/testnet-monitor/refresh", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      applySnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
      const fallback = await fetch("/api/testnet-monitor/snapshot", {
        cache: "no-store",
      });
      if (fallback.ok) {
        const data = await fallback.json();
        applySnapshot(data);
      }
    } finally {
      setBusy(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const selectedTrade = useMemo(() => {
    if (!snapshot || !selectedTradeId) return null;
    return (
      snapshot.closedTrades.find((t) => t.id === selectedTradeId) ??
      snapshot.openPositions.find((p) => p.id === selectedTradeId) ??
      null
    );
  }, [snapshot, selectedTradeId]);

  const decisionLinkage: TestnetDecisionLinkage = useMemo(() => {
    const id =
      selectedTrade && "decisionLogId" in selectedTrade
        ? selectedTrade.decisionLogId
        : null;
    const entry = id
      ? loadDecisionLog().find((e) => e.id === id)
      : null;
    return buildDecisionLinkage(id, entry);
  }, [selectedTrade]);

  const closePosition = async (pos: TestnetPosition) => {
    if (!doubleConfirm) {
      setError("Enable double confirmation before closing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/testnet-monitor/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: pos.id,
          symbol: pos.symbol,
          doubleConfirm: true,
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          governance: loadGovernanceState(),
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        appendBinanceTestnetJournalClient(data.journalEntry);
      }
      if (!res.ok) throw new Error(data.error ?? "Close blocked");
      setDoubleConfirm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(false);
    }
  };

  const updateLearningStatus = async (input: {
    route: string;
    learningRecordId?: string;
    notes?: string;
  }) => {
    if (!input.learningRecordId) {
      await refresh();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(input.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningRecordId: input.learningRecordId,
          notes: input.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Learning action failed");
      applySnapshot(data.snapshot ?? data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Learning action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkLearned = async (item: TestnetLearningQueueItem) => {
    await updateLearningStatus({
      route: "/api/testnet-monitor/learning/mark-learned",
      learningRecordId: item.learningRecordId,
    });
  };

  const handleGenerateReflection = async (item: TestnetLearningQueueItem) => {
    const notes = `TESTNET ${item.result} on ${item.symbol}: net PnL ${fmtUsd(item.netPnl)}. ${
      item.decisionLogId
        ? `Linked decision ${item.decisionLogId.slice(0, 8)}…`
        : "No AI decision link — operational validation only."
    }`;
    await updateLearningStatus({
      route: "/api/testnet-monitor/learning/generate-reflection",
      learningRecordId: item.learningRecordId,
      notes,
    });
  };

  const handleExcludeLearning = async (item: TestnetLearningQueueItem) => {
    await updateLearningStatus({
      route: "/api/testnet-monitor/learning/exclude",
      learningRecordId: item.learningRecordId,
    });
  };

  const summary = snapshot?.summary;
  const eq = snapshot?.executionQuality;
  const liveBlocked = summary?.liveTradingDisabled ?? true;

  return (
    <OpsShell
      badge="BINANCE TESTNET"
      title="AI Testnet Trade Monitor"
      subtitle="Monitor AI-created testnet orders, positions, and PnL. TESTNET only — not PAPER, SHADOW, or LIVE."
      accent="cyan"
      activePath={activePath}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-cyan-700/50 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
          TESTNET
        </span>
        <span className="rounded border border-rose-800/50 bg-rose-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
          LIVE DISABLED
        </span>
        <span className="text-[11px] text-zinc-500">
          Last refresh:{" "}
          {snapshot?.lastUpdatedAt
            ? new Date(snapshot.lastUpdatedAt).toLocaleString()
            : "—"}
        </span>
        <span className="text-[11px] text-zinc-500">
          Connection: {snapshot?.connected ? "Connected" : "Disconnected"}
        </span>
        <IncidentsV2Badge compact />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {liveBlocked && (
        <p className="mb-3 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          This monitor cannot open new orders. Reduce-only close requires double confirmation.
          Testnet PnL is labeled TESTNET and does not prove live profitability.
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <OpsKpi
          label="Open Positions"
          value={String(summary?.openPositionCount ?? 0)}
          hint="TESTNET only"
        />
        <OpsKpi
          label="Unrealized PnL"
          value={fmtUsd(summary?.totalUnrealizedPnl ?? 0)}
          mono
        />
        <OpsKpi
          label="Realized PnL"
          value={fmtUsd(summary?.totalRealizedPnl ?? 0)}
          mono
        />
        <OpsKpi
          label="Net PnL"
          value={fmtUsd(summary?.netPnl ?? 0)}
          mono
        />
        <OpsKpi
          label="Win Rate"
          value={`${(summary?.winRate ?? 0).toFixed(0)}%`}
          hint={`${summary?.winningTrades ?? 0}W / ${summary?.losingTrades ?? 0}L`}
        />
        <OpsKpi
          label="Daily Trades"
          value={String(
            snapshot?.dailyPnlSeries?.find(
              (d) => d.date === new Date().toISOString().slice(0, 10),
            )?.tradeCount ?? 0,
          )}
        />
        <OpsKpi
          label="Risk Status"
          value={summary?.riskStatus ?? "CAUTION"}
          hint="TESTNET monitor"
        />
        <OpsKpi
          label="Avg Slippage"
          value={`${eq?.averageSlippageBps ?? 0} bps`}
          hint="Execution quality"
        />
      </div>

      <label className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={doubleConfirm}
          onChange={(e) => setDoubleConfirm(e.target.checked)}
        />
        I confirm reduce-only close actions (double confirm)
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Open Positions">
          {(snapshot?.openPositions.length ?? 0) === 0 ? (
            <p className="text-xs text-zinc-500">
              No open testnet positions. Run a testnet preview from the cockpit or{" "}
              <Link href="/binance-testnet" className="text-cyan-400 hover:underline">
                Binance Testnet
              </Link>{" "}
              page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-1 pr-2">Symbol</th>
                    <th className="py-1 pr-2">Side</th>
                    <th className="py-1 pr-2">Size</th>
                    <th className="py-1 pr-2">Entry</th>
                    <th className="py-1 pr-2">Mark</th>
                    <th className="py-1 pr-2">uPnL</th>
                    <th className="py-1 pr-2">Source</th>
                    <th className="py-1">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot?.openPositions.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-900/80 cursor-pointer hover:bg-zinc-900/40"
                      onClick={() => setSelectedTradeId(p.id)}
                    >
                      <td className="py-2 pr-2 text-zinc-200">{p.symbol}</td>
                      <td className="py-2 pr-2">{p.side}</td>
                      <td className="py-2 pr-2 font-mono">{p.qty}</td>
                      <td className="py-2 pr-2 font-mono">{p.entryPrice}</td>
                      <td className="py-2 pr-2 font-mono">{p.markPrice}</td>
                      <td
                        className={`py-2 pr-2 font-mono ${p.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {fmtUsd(p.unrealizedPnl)} ({fmtPct(p.unrealizedPnlPct)})
                      </td>
                      <td className="py-2 pr-2">{p.source}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={busy || !doubleConfirm}
                          onClick={(e) => {
                            e.stopPropagation();
                            void closePosition(p);
                          }}
                          className="rounded border border-amber-800/50 px-2 py-0.5 text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Open Orders">
          {(snapshot?.openOrders.length ?? 0) === 0 ? (
            <p className="text-xs text-zinc-500">No open testnet orders.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {snapshot?.openOrders.map((o: TestnetOrder) => (
                <li key={o.id} className="rounded border border-zinc-800 p-2">
                  {o.symbol} {o.side} {o.orderType} · {o.qty} · {o.status}
                  {o.decisionLogId && (
                    <span className="ml-2 text-indigo-400">
                      dec {o.decisionLogId.slice(0, 8)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Closed Trades">
          {(snapshot?.closedTrades.length ?? 0) === 0 ? (
            <p className="text-xs text-zinc-500">
              No closed testnet trades yet. Closed trades will appear here after a
              position is closed.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-[11px] text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-1 pr-2">Symbol</th>
                    <th className="py-1 pr-2">Net PnL</th>
                    <th className="py-1 pr-2">Result</th>
                    <th className="py-1 pr-2">Duration</th>
                    <th className="py-1">Strategy</th>
                    <th className="py-1 text-right">Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot?.closedTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-zinc-900/80 cursor-pointer hover:bg-zinc-900/40"
                      onClick={() => setSelectedTradeId(t.id)}
                    >
                      <td className="py-2 pr-2 text-zinc-200">
                        {t.symbol} {t.side}
                      </td>
                      <td
                        className={`py-2 pr-2 font-mono ${t.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {fmtUsd(t.netPnl)}
                      </td>
                      <td className="py-2 pr-2">{t.result}</td>
                      <td className="py-2 pr-2">{durationLabel(t.durationMs)}</td>
                      <td className="py-2">{t.strategy ?? "—"}</td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/trades/${encodeURIComponent(t.id)}`}
                          className="text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Timeline
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="PnL Analytics">
          <div className="grid gap-3 text-xs text-zinc-400">
            <div>
              <p className="text-zinc-500">Equity (TESTNET)</p>
              <p className="font-mono text-zinc-200">
                {fmtUsd(
                  snapshot?.equitySeries?.at(-1)?.equity ??
                    summary?.netPnl ??
                    0,
                )}
              </p>
            </div>
            <div>
              <p className="mb-1 text-zinc-500">Daily PnL</p>
              {(snapshot?.dailyPnlSeries.length ?? 0) === 0 ? (
                <p className="text-zinc-600">No closed trades yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {snapshot?.dailyPnlSeries.slice(-7).map((d) => (
                    <li key={d.date}>
                      {d.date}: {fmtUsd(d.netPnl)} ({d.tradeCount} trades)
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-zinc-500">By Symbol</p>
              <ul className="space-y-0.5">
                {(snapshot?.pnlBySymbol ?? []).map((g) => (
                  <li key={g.label}>
                    {g.label}: {fmtUsd(g.netPnl)} · {g.tradeCount} trades
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-zinc-500">By Strategy</p>
              <ul className="space-y-0.5">
                {(snapshot?.pnlByStrategy ?? []).map((g) => (
                  <li key={g.label}>
                    {g.label}: {fmtUsd(g.netPnl)} · win {g.winRate.toFixed(0)}%
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[10px] text-zinc-600">
              Max drawdown: {fmtUsd(summary?.maxDrawdown ?? 0)} · Fees:{" "}
              {fmtUsd(summary?.totalFees ?? 0)}
            </p>
          </div>
        </Panel>

        <Panel title="Execution Quality (TESTNET)">
          {!eq ? (
            <p className="text-xs text-zinc-500">Execution quality not available.</p>
          ) : (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>
                Avg slippage: <span className="font-mono text-zinc-200">{eq.averageSlippageBps} bps</span>
              </p>
              <p>
                Latency: <span className="font-mono text-zinc-200">{Math.round(eq.averageLatencyMs)} ms</span>
              </p>
              <p>
                Rejection rate: <span className="font-mono text-zinc-200">{eq.rejectionRatePct}%</span>
              </p>
              <p>
                Failed close rate: <span className="font-mono text-zinc-200">{eq.failedCloseRatePct}%</span>
              </p>
              <p>
                Fee impact: <span className="font-mono text-zinc-200">{fmtUsd(eq.feeImpactUsd)}</span>
              </p>
              <p>
                Failed orders: <span className="font-mono text-zinc-200">{eq.failedOrderCount}</span> · close failures{" "}
                <span className="font-mono text-zinc-200">{eq.closeFailureCount}</span>
              </p>
              <p className={eq.liveQualityGate.status === "FAIL" ? "text-rose-300" : "text-amber-300"}>
                Live quality gate: {eq.liveQualityGate.status}
              </p>
              <Link href="/execution-quality" className="text-cyan-400 hover:underline">
                Open execution quality dashboard →
              </Link>
            </div>
          )}
        </Panel>

        <Panel title="AI Signal Linkage">
          {!selectedTrade ? (
            <p className="text-xs text-zinc-500">
              Select a position or closed trade to view AI decision linkage.
            </p>
          ) : (
            <div className="space-y-2 text-xs text-zinc-400">
              {decisionLinkage.message && (
                <p className="text-amber-300/90">{decisionLinkage.message}</p>
              )}
              <p>
                Decision ID:{" "}
                <span className="font-mono text-indigo-300">
                  {decisionLinkage.decisionLogId ?? "—"}
                </span>
              </p>
              <p>Final verdict: {decisionLinkage.finalVerdict ?? "—"}</p>
              <p>Risk veto: {decisionLinkage.riskVeto ? "Yes" : "No"}</p>
              <ul className="list-inside list-disc text-zinc-500">
                {decisionLinkage.topReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {decisionLinkage.decisionLogId && (
                <Link
                  href={`/?highlight=${decisionLinkage.decisionLogId}`}
                  className="text-cyan-400 hover:underline"
                >
                  View on desk →
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Learning Queue (TESTNET)">
          {learningQueue.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No closed trades pending learning review.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {learningQueue.map((item) => (
                <li
                  key={item.closedTradeId}
                  className="rounded border border-zinc-800 p-2 text-zinc-400"
                >
                  <span className="text-zinc-200">{item.symbol}</span> ·{" "}
                  {item.result} · {fmtUsd(item.netPnl)} · {item.status}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.status !== "LEARNED" && item.status !== "EXCLUDED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleMarkLearned(item)}
                        className="rounded border border-emerald-800/50 px-2 py-0.5 text-emerald-300 hover:bg-emerald-950/40"
                      >
                        Mark as learned
                      </button>
                    )}
                    {item.status !== "PENDING_REVIEW" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void updateLearningStatus({
                            route: "/api/testnet-monitor/learning/pending-review",
                            learningRecordId: item.learningRecordId,
                          })
                        }
                        className="rounded border border-cyan-800/50 px-2 py-0.5 text-cyan-300 hover:bg-cyan-950/40"
                      >
                        Pending review
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || item.status === "EXCLUDED"}
                      onClick={() => void handleGenerateReflection(item)}
                      className="rounded border border-violet-800/50 px-2 py-0.5 text-violet-300 hover:bg-violet-950/40"
                    >
                      Generate reflection
                    </button>
                    {item.status !== "EXCLUDED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleExcludeLearning(item)}
                        className="rounded border border-zinc-700/60 px-2 py-0.5 text-zinc-300 hover:bg-zinc-900/60"
                      >
                        Exclude from learning
                      </button>
                    )}
                  </div>
                  {item.reflectionNotes && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {item.reflectionNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-2 text-[11px] text-zinc-400 sm:grid-cols-3">
            <div className="rounded border border-zinc-800/80 p-2">
              <p className="text-zinc-500">TESTNET Agent scoreboard</p>
              <p className="font-mono text-zinc-200">
                {snapshot?.agentScoreboardSegment.totalLearned ?? 0} learned
              </p>
            </div>
            <div className="rounded border border-zinc-800/80 p-2">
              <p className="text-zinc-500">TESTNET Strategy performance</p>
              <p className="font-mono text-zinc-200">
                {snapshot?.strategyPerformanceSegment.totalLearned ?? 0} learned
              </p>
            </div>
            <div className="rounded border border-zinc-800/80 p-2">
              <p className="text-zinc-500">TESTNET Validation metrics</p>
              <p className="font-mono text-zinc-200">
                win {(snapshot?.validationMetricsSegment.winRate ?? 0).toFixed(0)}% · R{" "}
                {(snapshot?.validationMetricsSegment.averageR ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            TESTNET learning updates testnet performance segment only — not mixed
            with PAPER or LIVE metrics.
          </p>
        </Panel>
      </div>

      {(snapshot?.mismatches.length ?? 0) > 0 && (
        <Panel title="Reconciliation Warnings" className="mt-4">
          <ul className="space-y-1 text-xs text-amber-300/90">
            {snapshot?.mismatches.map((m) => (
              <li key={m}>· {m}</li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-4 text-xs text-zinc-600">
        <Link href="/binance-testnet" className="text-cyan-500 hover:underline">
          Binance testnet desk
        </Link>
        {" · "}
        <Link href="/" className="text-cyan-500 hover:underline">
          Desk cockpit
        </Link>
        {" · "}
        <Link href="/ledger" className="text-cyan-500 hover:underline">
          Unified ledger (TESTNET)
        </Link>
      </p>
    </OpsShell>
  );
}

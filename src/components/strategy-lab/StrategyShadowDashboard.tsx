"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type { QuantBacktestSymbol } from "@/lib/quant-backtest/types";
import type {
  ShadowPromotionCandidate,
  ShadowStrategyMetrics,
  StrategyShadowReport,
} from "@/lib/strategy-shadow/types";
import {
  SHADOW_PROMOTION_RULES,
  STRATEGY_SHADOW_SAFETY_NOTICE,
} from "@/lib/strategy-shadow/types";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetricsRow({ m }: { m: ShadowStrategyMetrics }) {
  return (
    <tr className="border-t border-zinc-800/60 text-xs text-zinc-300">
      <td className="py-2 pr-3 font-medium">{m.strategyName}</td>
      <td className="py-2 pr-3">{m.closedTrades}</td>
      <td className="py-2 pr-3">{m.winRate}%</td>
      <td className={`py-2 pr-3 ${m.shadowPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {m.shadowPnL}%
      </td>
      <td className="py-2 pr-3 text-amber-300">{m.maxDrawdownPct}%</td>
      <td className="py-2 pr-3 text-rose-300">{m.falsePositives}</td>
      <td className="py-2 pr-3 text-cyan-300">{m.falseNegatives}</td>
    </tr>
  );
}

function PromotionCard({
  candidate,
  onPromote,
  busy,
}: {
  candidate: ShadowPromotionCandidate;
  onPromote: (sourceId: string) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-zinc-200">{candidate.strategyName}</span>
        <span className="text-zinc-600">{candidate.importStatus}</span>
        {candidate.eligible ? (
          <span className="rounded border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
            Eligible
          </span>
        ) : (
          <span className="rounded border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
            Not ready
          </span>
        )}
      </div>
      <p className="mt-2 text-zinc-500">
        n={candidate.metrics.closedTrades} · win {candidate.metrics.winRate}% · PnL{" "}
        {candidate.metrics.shadowPnL}% · DD {candidate.metrics.maxDrawdownPct}%
      </p>
      {candidate.blockers.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-200/80">
          {candidate.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {candidate.eligible && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPromote(candidate.sourceId)}
          className="mt-3 rounded bg-teal-800/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-teal-700 disabled:opacity-50"
        >
          Approve promotion → READY_FOR_BACKTEST
        </button>
      )}
    </div>
  );
}

const LAB_NAV = [
  { href: "/strategy-garage", label: "Garage", primary: true },
  { href: "/strategy-lab/imports", label: "Imports" },
  { href: "/strategy-lab/backtest", label: "Backtest" },
  { href: "/strategy-lab/tournament", label: "Tournament" },
  { href: "/strategy-lab/shadow", label: "Shadow" },
  { href: "/strategies", label: "Registry" },
  { href: "/", label: "← Desk" },
];

export default function StrategyShadowDashboard() {
  const [symbol, setSymbol] = useState<QuantBacktestSymbol>("BTCUSDT");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [report, setReport] = useState<StrategyShadowReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReport = useCallback(async (refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        symbol,
        lookbackDays: String(lookbackDays),
        ...(refresh ? { refresh: "true" } : {}),
      });
      const res = await fetch(`/api/strategy-shadow/report?${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setReport(data.report as StrategyShadowReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setBusy(false);
    }
  }, [symbol, lookbackDays]);

  useEffect(() => {
    void loadReport(false);
  }, [loadReport]);

  const runShadow = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/strategy-shadow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, lookbackDays, mode: "replay" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setReport(data.report as StrategyShadowReport);
      setMessage(
        `Shadow replay complete — ${data.quantTradeCount} quant trades, ${data.aiTradeCount} AI committee traces.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shadow run failed");
    } finally {
      setBusy(false);
    }
  };

  const promote = async (sourceId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/strategy-shadow/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          humanApproval: true,
          operatorNote: "Shadow MVP 70 user-approved promotion",
          targetStatus: "READY_FOR_BACKTEST",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error);
      setMessage(data.message as string);
      await loadReport(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  const comparison = report?.comparison;
  const totalTrades = report?.trades.length ?? 0;

  return (
    <OpsShell
      badge="MVP 70 · Shadow"
      title="Strategy Shadow Mode"
      subtitle="Virtual trades for imported quant strategies and AI committee — no orders, no testnet, not live proof."
      accent="teal"
      iconLetters="SH"
      activePath="/strategy-lab/shadow"
      nav={LAB_NAV}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void runShadow()}
          className="rounded-lg bg-teal-700/90 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-teal-600 disabled:opacity-50"
        >
          {busy ? "Running..." : "Run shadow replay"}
        </button>
      }
    >
      <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-xs text-rose-200/90">
        {STRATEGY_SHADOW_SAFETY_NOTICE}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-500">
          Symbol
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as QuantBacktestSymbol)}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-200"
          >
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="SOLUSDT">SOLUSDT</option>
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Lookback (days)
          <input
            type="number"
            min={30}
            max={365}
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value) || 90)}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-200"
          />
        </label>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OpsKpi label="Shadow trades" value={String(totalTrades)} />
        <OpsKpi
          label="Shadow win rate"
          value={comparison ? `${comparison.shadowWinRate}%` : "—"}
        />
        <OpsKpi
          label="Shadow PnL"
          value={comparison ? `${comparison.shadowPnL}%` : "—"}
        />
        <OpsKpi label="False positives" value={String(comparison?.falsePositives ?? "—")} />
        <OpsKpi label="False negatives" value={String(comparison?.falseNegatives ?? "—")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Imported strategies vs AI committee">
          {report?.byStrategy.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase text-zinc-600">
                  <tr>
                    <th className="pb-2 pr-3">Strategy</th>
                    <th className="pb-2 pr-3">n</th>
                    <th className="pb-2 pr-3">Win%</th>
                    <th className="pb-2 pr-3">PnL%</th>
                    <th className="pb-2 pr-3">Max DD</th>
                    <th className="pb-2 pr-3">FP</th>
                    <th className="pb-2 pr-3">FN</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byStrategy.map((m) => (
                    <MetricsRow key={m.sourceId} m={m} />
                  ))}
                  {report.aiCommittee && <MetricsRow m={report.aiCommittee} />}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No shadow data yet.{" "}
              <button
                type="button"
                onClick={() => void runShadow()}
                className="text-teal-400 hover:underline"
              >
                Run shadow replay
              </button>{" "}
              or import strategies from{" "}
              <Link href="/strategy-lab/imports" className="text-teal-400 hover:underline">
                Imports
              </Link>
              .
            </p>
          )}
        </Panel>

        <Panel title="Comparison with actual AI trades">
          {comparison ? (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>{comparison.summary}</p>
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-zinc-600">AI paper win rate</dt>
                  <dd className="text-zinc-200">{comparison.aiWinRate}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-600">AI paper PnL</dt>
                  <dd className="text-zinc-200">{comparison.aiPnL}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Shadow win rate</dt>
                  <dd className="text-zinc-200">{comparison.shadowWinRate}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Shadow PnL</dt>
                  <dd className="text-zinc-200">{comparison.shadowPnL}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Win rate delta</dt>
                  <dd
                    className={
                      comparison.winRateDelta >= 0 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {comparison.winRateDelta > 0 ? "+" : ""}
                    {comparison.winRateDelta}%
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600">PnL delta</dt>
                  <dd
                    className={comparison.pnlDelta >= 0 ? "text-emerald-400" : "text-rose-400"}
                  >
                    {comparison.pnlDelta > 0 ? "+" : ""}
                    {comparison.pnlDelta}%
                  </dd>
                </div>
              </dl>
              <p className="text-[10px] text-zinc-600">
                AI sample: {comparison.aiSampleSize} strict paper trades · Shadow cannot count as
                live proof.
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Run shadow replay to compare with AI paper trades.</p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Promotion candidates">
          <p className="mb-3 text-[11px] text-zinc-600">
            Rules: min {SHADOW_PROMOTION_RULES.minSampleSize} closed trades · max{" "}
            {SHADOW_PROMOTION_RULES.maxDrawdownPct}% drawdown · min {SHADOW_PROMOTION_RULES.minWinRate}%
            win rate · human approval required.
          </p>
          {report?.promotionCandidates.length ? (
            <div className="space-y-2">
              {report.promotionCandidates.map((c) => (
                <PromotionCard
                  key={c.sourceId}
                  candidate={c}
                  onPromote={promote}
                  busy={busy}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No quant strategies with shadow samples yet.</p>
          )}
        </Panel>

        <Panel title="Recent shadow trades">
          {report?.trades.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-[11px] text-zinc-400">
              {report.trades.slice(0, 20).map((t) => (
                <li
                  key={t.id}
                  className="rounded border border-zinc-800/60 bg-zinc-950/40 px-2 py-1.5"
                >
                  <span className="font-medium text-zinc-300">{t.strategyName}</span> · {t.side} ·
                  entry ${t.entryPrice.toLocaleString()}
                  {t.virtualExit != null && ` → $${t.virtualExit.toLocaleString()}`}
                  {t.virtualPnL != null && (
                    <span
                      className={
                        t.virtualPnL >= 0 ? " text-emerald-400" : " text-rose-400"
                      }
                    >
                      {" "}
                      ({t.virtualPnL}%)
                    </span>
                  )}{" "}
                  · {t.result}
                  {t.falsePositive && (
                    <span className="text-rose-300"> · false positive</span>
                  )}
                  {t.falseNegative && (
                    <span className="text-cyan-300"> · false negative</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Shadow trade log empty.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type { ExecutionQualitySummary } from "@/lib/execution-quality";

function usd(n: number): string {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function ExecutionQualityDashboard() {
  const [summary, setSummary] = useState<ExecutionQualitySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/execution-quality", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load execution quality");
      setSummary(data.summary as ExecutionQualitySummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load execution quality");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="MVP 54 · Monitor only"
      title="Execution Quality Monitor"
      subtitle="Measure testnet/live execution reliability (slippage, latency, rejects, close failures). Read-only telemetry only."
      accent="cyan"
      iconLetters="EQ"
      activePath="/execution-quality"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/testnet-monitor", label: "Testnet monitor" },
        { href: "/live-evidence", label: "Live evidence", primary: true },
        { href: "/strategy-health", label: "Strategy health" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-cyan-800/60 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <p className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-200/80">
        This module cannot execute orders. It only monitors execution quality and informs readiness gates.
      </p>
      {error && <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi label="Average slippage" value={`${summary.averageSlippageBps} bps`} />
            <OpsKpi label="Fee impact" value={usd(summary.feeImpactUsd)} />
            <OpsKpi label="Failed orders" value={String(summary.failedOrderCount)} />
            <OpsKpi
              label="Close failures"
              value={String(summary.closeFailureCount)}
              hint={`${summary.failedCloseRatePct}%`}
            />
            <OpsKpi
              label="Rejection rate"
              value={`${summary.rejectionRatePct}%`}
              hint={`Retries ${summary.retryCountTotal}`}
            />
            <OpsKpi
              label="Latency (avg)"
              value={`${Math.round(summary.averageLatencyMs)} ms`}
              hint="Execution submit->ack"
            />
            <OpsKpi
              label="Partial fill"
              value={`${summary.partialFillRatePct}%`}
              hint="Testnet+live stream"
            />
            <OpsKpi
              label="Quality gate"
              value={summary.liveQualityGate.status}
              hint={summary.liveQualityGate.blocksLiveReadiness ? "Blocks live readiness" : "No hard block"}
            />
          </div>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Slippage by symbol</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs text-zinc-300">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pb-2 pr-3">Symbol</th>
                    <th className="pb-2 pr-3">Attempts</th>
                    <th className="pb-2 pr-3">Avg slippage</th>
                    <th className="pb-2 pr-3">Rejection</th>
                    <th className="pb-2 pr-3">Close fail</th>
                    <th className="pb-2 pr-3">Partial fill</th>
                    <th className="pb-2 pr-3">Avg latency</th>
                    <th className="pb-2">Fee impact</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.slippageBySymbol.map((row) => (
                    <tr key={row.symbol} className="border-t border-zinc-800/70">
                      <td className="py-2 pr-3">{row.symbol}</td>
                      <td className="py-2 pr-3 font-mono">{row.attempts}</td>
                      <td className="py-2 pr-3 font-mono">{row.avgSlippageBps} bps</td>
                      <td className="py-2 pr-3 font-mono">{row.rejectionRatePct}%</td>
                      <td className="py-2 pr-3 font-mono">{row.failedCloseRatePct}%</td>
                      <td className="py-2 pr-3 font-mono">{row.partialFillRatePct}%</td>
                      <td className="py-2 pr-3 font-mono">{Math.round(row.avgLatencyMs)} ms</td>
                      <td className="py-2 font-mono">{usd(row.feeImpactUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Latency trend</h2>
            {summary.latencyTrend.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No latency samples yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {summary.latencyTrend.map((point) => (
                  <li key={point.bucket}>
                    {point.bucket}: {Math.round(point.avgLatencyMs)} ms ({point.attempts} attempts)
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Exchange error table</h2>
            {summary.exchangeErrors.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No execution errors found.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs text-zinc-300">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="pb-2 pr-3">Error</th>
                      <th className="pb-2 pr-3">Count</th>
                      <th className="pb-2 pr-3">Last seen</th>
                      <th className="pb-2">Symbol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.exchangeErrors.map((row) => (
                      <tr key={`${row.error}-${row.lastSeenAt}`} className="border-t border-zinc-800/70">
                        <td className="py-2 pr-3">{row.error}</td>
                        <td className="py-2 pr-3 font-mono">{row.count}</td>
                        <td className="py-2 pr-3">{new Date(row.lastSeenAt).toLocaleString()}</td>
                        <td className="py-2">{row.symbol ?? "n/a"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-[10px] text-zinc-600">
            Quality gate links into <Link href="/live-evidence" className="text-cyan-400 hover:underline">Live Evidence</Link>,{" "}
            <Link href="/strategy-health" className="text-cyan-400 hover:underline">Strategy Health</Link>, and incident detection.
          </p>
        </>
      )}
    </OpsShell>
  );
}


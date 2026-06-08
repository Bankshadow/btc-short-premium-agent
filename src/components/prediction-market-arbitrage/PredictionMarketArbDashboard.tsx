"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  ArbOpportunity,
  PredictionArbScanLogEntry,
  PredictionArbScanResult,
} from "@/lib/prediction-market-arbitrage/types";
import { PREDICTION_ARB_SAFETY_NOTICE } from "@/lib/prediction-market-arbitrage/types";

function statusBadge(status: ArbOpportunity["status"]): string {
  if (status === "TRADE")
    return "border-emerald-800/60 bg-emerald-950/40 text-emerald-300";
  if (status === "WATCH")
    return "border-amber-800/60 bg-amber-950/40 text-amber-300";
  return "border-zinc-800 bg-zinc-950/60 text-zinc-500";
}

function typeLabel(type: ArbOpportunity["opportunityType"]): string {
  return type === "BUY_BUNDLE" ? "Buy bundle" : "Sell bundle";
}

export default function PredictionMarketArbDashboard() {
  const [scan, setScan] = useState<PredictionArbScanResult | null>(null);
  const [logs, setLogs] = useState<PredictionArbScanLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockOnly, setMockOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/prediction-market-arbitrage/replay");
      const data = await res.json();
      if (data.ok) setLogs(data.logs ?? []);
    } catch {
      /* optional */
    }
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = mockOnly ? "?mockOnly=true" : "";
      const res = await fetch(`/api/prediction-market-arbitrage/scan${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Scan failed");
      setScan(data.result as PredictionArbScanResult);
      await loadLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [mockOnly, loadLogs]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const opportunities = scan?.opportunities ?? [];

  return (
    <OpsShell
      badge="MVP 79 · Paper only"
      title="Prediction Market Arbitrage"
      subtitle={`Polymarket-style scanner — mispricing, depth, resolution risk, committee. ${PREDICTION_ARB_SAFETY_NOTICE}`}
      accent="violet"
      iconLetters="PA"
      activePath="/prediction-markets"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <input
              type="checkbox"
              checked={mockOnly}
              onChange={(e) => setMockOnly(e.target.checked)}
              className="rounded border-zinc-700"
            />
            Mock only
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runScan()}
            className="rounded-lg border border-violet-800/60 bg-violet-950/40 px-3 py-2 text-xs text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Run scan"}
          </button>
        </div>
      }
    >
      {error && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Markets scanned" value={String(scan?.marketsScanned ?? "—")} />
        <OpsKpi label="Candidates" value={String(scan?.candidatesFound ?? "—")} />
        <OpsKpi
          label="TRADE / WATCH / NO"
          value={
            scan
              ? `${scan.tradeCount} / ${scan.watchCount} / ${scan.noTradeCount}`
              : "—"
          }
        />
        <OpsKpi label="Data source" value={scan?.dataSource ?? "—"} />
      </div>

      <section className="desk-panel overflow-hidden">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h2 className="desk-section-title">Opportunity table</h2>
          {scan?.generatedAt && (
            <p className="mt-0.5 text-[10px] text-zinc-600">
              Scan {scan.scanLogId} · {new Date(scan.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 text-[10px] uppercase tracking-wide text-zinc-600">
                <th className="px-3 py-2">Event / Market</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Theo edge</th>
                <th className="px-3 py-2">Exec edge</th>
                <th className="px-3 py-2">Depth</th>
                <th className="px-3 py-2">Capital</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">No-trade reason</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                    {loading ? "Scanning markets…" : "No mispricing candidates this cycle."}
                  </td>
                </tr>
              )}
              {opportunities.map((opp) => (
                <Fragment key={opp.id}>
                  <tr
                    className="border-b border-zinc-900/80 hover:bg-zinc-950/40 cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === opp.id ? null : opp.id)
                    }
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-200">{opp.eventTitle}</p>
                      <p className="text-[10px] text-zinc-500">{opp.marketTitle}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {opp.marketType === "BINARY" ? "Binary" : "Multi"} ·{" "}
                      {typeLabel(opp.opportunityType)}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-300">
                      {opp.theoreticalEdgePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 font-mono text-emerald-300/90">
                      {opp.executableEdgePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-400">
                      ${opp.executableSizeUsd.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-400">
                      ${opp.requiredCapitalUsd.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <span
                        className={
                          opp.resolutionBlocked ? "text-rose-400" : "text-zinc-400"
                        }
                      >
                        {opp.resolutionRiskScore}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${statusBadge(opp.status)}`}
                      >
                        {opp.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[10px] text-zinc-500">
                      {opp.noTradeReason ?? "—"}
                    </td>
                  </tr>
                  {expandedId === opp.id && (
                    <tr className="bg-zinc-950/50">
                      <td colSpan={9} className="px-4 py-3 text-[11px] text-zinc-400">
                        <p className="text-violet-300/90">{opp.committeeSummary}</p>
                        <p className="mt-2">
                          Sim profit ${opp.simulation.expectedProfitUsd} · worst-case -$
                          {opp.simulation.worstCaseLossUsd} · confidence{" "}
                          {opp.simulation.confidenceScore}
                        </p>
                        <ul className="mt-2 list-inside list-disc space-y-0.5">
                          {opp.agentVotes.map((v) => (
                            <li key={v.agentName}>
                              <span className="text-zinc-300">{v.agentName}</span>:{" "}
                              {v.recommendation} — {v.reasons[0]}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {logs.length > 0 && (
        <section className="desk-panel px-4 py-3">
          <h2 className="desk-section-title">Scan replay log</h2>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            {logs.slice(0, 8).map((log) => (
              <li key={log.id} className="font-mono">
                {log.id} · {new Date(log.generatedAt).toLocaleString()} ·{" "}
                {log.opportunities.length} opps · {log.dataSource}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[11px] text-zinc-600">
        {scan?.disclaimer ?? PREDICTION_ARB_SAFETY_NOTICE}
      </p>
    </OpsShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  MultiAssetScanResult,
  PerpDirectionalSignal,
  PerpPaperPosition,
} from "@/lib/multi-asset/types";
import {
  autoOpenFromScan,
  closePerpPosition,
  loadPerpPositions,
  markPerpPositions,
  openPerpPositionFromSignal,
  summarizePerpPortfolio,
  type PerpPortfolioSummary,
} from "@/lib/multi-asset/perp-paper-store";

function directionBadge(direction: PerpDirectionalSignal["direction"]): string {
  if (direction === "LONG")
    return "border-emerald-800/60 bg-emerald-950/40 text-emerald-300";
  if (direction === "SHORT")
    return "border-rose-800/60 bg-rose-950/40 text-rose-300";
  return "border-zinc-800 bg-zinc-950/60 text-zinc-500";
}

function confidenceBadge(c: PerpDirectionalSignal["confidence"]): string {
  if (c === "HIGH") return "text-emerald-300";
  if (c === "MEDIUM") return "text-amber-300";
  return "text-zinc-500";
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-400";
}

function fmtPrice(value: number): string {
  if (value <= 0) return "—";
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export default function MultiAssetDashboard() {
  const [scan, setScan] = useState<MultiAssetScanResult | null>(null);
  const [positions, setPositions] = useState<PerpPaperPosition[]>([]);
  const [summary, setSummary] = useState<PerpPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState(true);
  const [lastOpened, setLastOpened] = useState<number | null>(null);

  const refreshLocal = useCallback(() => {
    setPositions(loadPerpPositions().filter((p) => p.status === "OPEN"));
    setSummary(summarizePerpPortfolio());
  }, []);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal]);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastOpened(null);
    try {
      const res = await fetch("/api/multi-asset/scan", { method: "GET" });
      const data = (await res.json()) as MultiAssetScanResult & { error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Scan failed (${res.status})`);
      }
      setScan(data);
      markPerpPositions(data.signals);
      if (autoOpen) {
        const opened = autoOpenFromScan(data.signals);
        setLastOpened(opened.length);
      }
      refreshLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [autoOpen, refreshLocal]);

  const handleOpenManual = useCallback(
    (signal: PerpDirectionalSignal) => {
      const opened = openPerpPositionFromSignal(signal, "manual");
      if (opened) refreshLocal();
    },
    [refreshLocal],
  );

  const handleClose = useCallback(
    (position: PerpPaperPosition) => {
      const mark =
        scan?.signals.find((s) => s.symbol === position.symbol)?.price ??
        position.lastMarkPrice;
      closePerpPosition(position.id, mark);
      refreshLocal();
    },
    [scan, refreshLocal],
  );

  const actionable = scan?.actionableCount ?? 0;
  const scanned = scan?.signals.length ?? 0;

  return (
    <OpsShell
      badge="Multi-Asset Desk"
      title="Perp Directional Scanner"
      subtitle="LONG / SHORT bias across BTC · SOL · WLD · LINK · DOGE perpetuals. Paper-first — actionable signals open simulated positions only. No live orders."
      accent="emerald"
      iconLetters="MA"
      activePath="/assets"
      actions={
        <>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoOpen}
              onChange={(e) => setAutoOpen(e.target.checked)}
              className="accent-emerald-500"
            />
            Auto-open paper
          </label>
          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Run scan"}
          </button>
        </>
      }
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OpsKpi label="Assets scanned" value={String(scanned)} />
        <OpsKpi label="Actionable signals" value={String(actionable)} hint="conviction ≥ threshold" />
        <OpsKpi label="Open paper positions" value={String(summary?.openCount ?? 0)} />
        <OpsKpi
          label="Unrealized PnL"
          value={`${(summary?.totalUnrealizedPct ?? 0).toFixed(2)}%`}
          mono
        />
      </section>

      {error && (
        <div className="desk-panel border-rose-900/50 px-5 py-4 text-sm text-rose-300">
          Scan error: {error}
          <p className="mt-1 text-xs text-zinc-500">
            Bybit public API may be rate-limited or blocked from the server.
            Try again shortly.
          </p>
        </div>
      )}

      {lastOpened !== null && (
        <div className="desk-panel border-emerald-900/40 px-5 py-3 text-sm text-emerald-300">
          Auto-opened {lastOpened} paper position{lastOpened === 1 ? "" : "s"} from
          this scan (simulated — no live order placed).
        </div>
      )}

      {scan && (
        <section className="desk-panel overflow-hidden px-0 py-0">
          <div className="border-b border-zinc-800/80 px-5 py-3">
            <p className="desk-section-title text-emerald-300/90">Directional Signals</p>
            <p className="text-xs text-zinc-500">
              Ranked by conviction · scanned{" "}
              {new Date(scan.generatedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-600">
                <tr className="border-b border-zinc-800/60">
                  <th className="px-4 py-2">Asset</th>
                  <th className="px-3 py-2">Bias</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Conf</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">24h</th>
                  <th className="px-3 py-2">Funding</th>
                  <th className="px-3 py-2">Trend</th>
                  <th className="px-3 py-2">RSI</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {scan.signals.map((s) => (
                  <tr
                    key={s.symbol}
                    className="border-b border-zinc-900/60 text-zinc-300"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-zinc-100">{s.label}</div>
                      <div className="font-mono text-[10px] text-zinc-600">
                        {s.symbol}
                        {!s.hasOptions && " · perp only"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${directionBadge(s.direction)}`}
                      >
                        {s.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {s.error ? "—" : s.score}
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${confidenceBadge(s.confidence)}`}>
                      {s.confidence}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{fmtPrice(s.price)}</td>
                    <td className={`px-3 py-2.5 font-mono ${pnlColor(s.priceChange24hPct)}`}>
                      {s.price > 0 ? `${s.priceChange24hPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">
                      {s.fundingRatePct === null
                        ? "—"
                        : `${s.fundingRatePct.toFixed(4)}%`}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-zinc-400">{s.trend}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{s.rsi14}</td>
                    <td className="px-3 py-2.5 text-right">
                      {s.actionable ? (
                        <button
                          type="button"
                          onClick={() => handleOpenManual(s)}
                          className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/40"
                        >
                          Open paper
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {scan && (
        <section className="grid gap-3 lg:grid-cols-2">
          {scan.signals
            .filter((s) => s.reasons.length > 0 || s.risks.length > 0)
            .map((s) => (
              <div key={`detail-${s.symbol}`} className="desk-panel px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-200">{s.label}</p>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${directionBadge(s.direction)}`}
                  >
                    {s.direction} · {s.confidence}
                  </span>
                </div>
                {s.reasons.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                    {s.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                )}
                {s.risks.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-300/80">
                    {s.risks.map((r, i) => (
                      <li key={i}>⚠ {r}</li>
                    ))}
                  </ul>
                )}
                {s.actionable && (
                  <p className="mt-2 font-mono text-[10px] text-zinc-600">
                    size {s.suggestedSizePct}% · SL {fmtPrice(s.stopLoss ?? 0)} · TP{" "}
                    {fmtPrice(s.takeProfit ?? 0)}
                  </p>
                )}
              </div>
            ))}
        </section>
      )}

      <section className="desk-panel overflow-hidden px-0 py-0">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3">
          <div>
            <p className="desk-section-title text-emerald-300/90">Open Paper Positions</p>
            <p className="text-xs text-zinc-500">
              Simulated · win rate {summary?.winRatePct ?? 0}% · realized{" "}
              {(summary?.totalRealizedPct ?? 0).toFixed(2)}%
            </p>
          </div>
        </div>
        {positions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-600">
            No open paper positions. Run a scan with auto-open enabled, or open one
            manually from a signal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-600">
                <tr className="border-b border-zinc-800/60">
                  <th className="px-4 py-2">Asset</th>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">Mark</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">uPnL</th>
                  <th className="px-3 py-2">Opened</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-900/60 text-zinc-300">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-zinc-100">{p.label}</div>
                      <div className="font-mono text-[10px] text-zinc-600">{p.symbol}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${directionBadge(p.direction)}`}
                      >
                        {p.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{fmtPrice(p.entryPrice)}</td>
                    <td className="px-3 py-2.5 font-mono">{fmtPrice(p.lastMarkPrice)}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{p.sizePct}%</td>
                    <td className={`px-3 py-2.5 font-mono ${pnlColor(p.unrealizedPnlPct)}`}>
                      {p.unrealizedPnlPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500">
                      {new Date(p.openedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleClose(p)}
                        className="rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-500"
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
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-zinc-600">
        {scan?.disclaimer ??
          "Analysis-only / paper-first. Directional signals never place live orders."}
      </p>
    </OpsShell>
  );
}

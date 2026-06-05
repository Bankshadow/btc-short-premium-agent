"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExchangeStatusResult } from "@/lib/exchange/types";

function fmtUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPrice(value: number): string {
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function pnlClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-400";
}

export default function ExchangeStatusPanel() {
  const [status, setStatus] = useState<ExchangeStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exchange/status");
      const data = (await res.json()) as ExchangeStatusResult & { error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exchange status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="desk-panel border-cyan-900/40 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="desk-section-title text-cyan-300/90">Exchange (read-only)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            MVP 32 — live wallet, positions, and open orders from Bybit. No order placement.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-cyan-900/50 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-900/30 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh exchange"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-300">Error: {error}</p>
      )}

      {!status && !error && (
        <p className="mt-3 text-xs text-zinc-600">Loading exchange status…</p>
      )}

      {status && !status.configured && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-xs text-zinc-400">
          <p className="font-medium text-zinc-300">Not configured</p>
          <p className="mt-1">{status.envHint}</p>
          <p className="mt-2 text-[10px] text-zinc-600">
            Add env vars on Vercel (or `.env.local` locally), redeploy, then refresh.
          </p>
        </div>
      )}

      {status?.configured && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3 text-xs">
            <span
              className={`rounded-md px-2 py-1 ring-1 ${
                status.connected
                  ? "bg-emerald-950/50 text-emerald-300 ring-emerald-900/60"
                  : "bg-rose-950/50 text-rose-300 ring-rose-900/60"
              }`}
            >
              {status.connected ? "Connected" : "Auth failed"}
            </span>
            <span className="rounded-md bg-zinc-900 px-2 py-1 text-zinc-400">
              Network: {status.network ?? "—"}
            </span>
            {status.clockSkewMs !== null && (
              <span
                className={`rounded-md px-2 py-1 ${
                  status.clockSkewMs > 5000
                    ? "bg-amber-950/50 text-amber-300"
                    : "bg-zinc-900 text-zinc-500"
                }`}
              >
                Clock skew: {Math.round(status.clockSkewMs / 1000)}s
              </span>
            )}
          </div>

          {status.error && (
            <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {status.error}
              {status.envHint && <p className="mt-1 text-rose-300/80">{status.envHint}</p>}
            </div>
          )}

          {status.wallet && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Wallet (UNIFIED)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
                  <p className="text-[10px] text-zinc-600">Total equity</p>
                  <p className="font-mono text-sm text-zinc-100">
                    ${fmtUsd(status.wallet.totalEquityUsd)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
                  <p className="text-[10px] text-zinc-600">Wallet balance</p>
                  <p className="font-mono text-sm text-zinc-100">
                    ${fmtUsd(status.wallet.totalWalletBalanceUsd)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
                  <p className="text-[10px] text-zinc-600">Coins</p>
                  <p className="text-sm text-zinc-300">
                    {status.wallet.coins.length > 0
                      ? status.wallet.coins.map((c) => c.coin).join(", ")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">
              Linear positions ({status.linearPositions.length})
            </p>
            {status.linearPositions.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-600">No open linear positions.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[11px]">
                  <thead className="text-zinc-600">
                    <tr>
                      <th className="pb-1 pr-2">Symbol</th>
                      <th className="pb-1 pr-2">Side</th>
                      <th className="pb-1 pr-2">Size</th>
                      <th className="pb-1 pr-2">Mark</th>
                      <th className="pb-1 pr-2">uPnL</th>
                      <th className="pb-1">Lev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.linearPositions.map((p) => (
                      <tr key={`${p.category}-${p.symbol}`} className="border-t border-zinc-800/80">
                        <td className="py-1.5 pr-2 font-mono text-zinc-200">{p.symbol}</td>
                        <td className="py-1.5 pr-2">{p.side}</td>
                        <td className="py-1.5 pr-2 font-mono">{p.size}</td>
                        <td className="py-1.5 pr-2 font-mono">{fmtPrice(p.markPrice)}</td>
                        <td className={`py-1.5 pr-2 font-mono ${pnlClass(p.unrealisedPnl)}`}>
                          {fmtUsd(p.unrealisedPnl)}
                        </td>
                        <td className="py-1.5">{p.leverage}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">
              BTC option positions ({status.optionPositions.length})
            </p>
            {status.optionPositions.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-600">No open option positions.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-[11px] text-zinc-400">
                {status.optionPositions.map((p) => (
                  <li key={p.symbol}>
                    {p.symbol} · {p.side} · size {p.size} · uPnL{" "}
                    <span className={pnlClass(p.unrealisedPnl)}>
                      {fmtUsd(p.unrealisedPnl)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(status.openLinearOrders.length > 0 || status.openOptionOrders.length > 0) && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Open orders</p>
              <p className="mt-1 text-xs text-zinc-500">
                Linear: {status.openLinearOrders.length} · Options:{" "}
                {status.openOptionOrders.length}
              </p>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-zinc-600">{status.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

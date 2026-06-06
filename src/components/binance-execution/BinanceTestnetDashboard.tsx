"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import {
  appendBinanceTestnetJournalClient,
  loadBinanceTestnetJournalClient,
  updateBinanceTestnetJournalClient,
} from "@/lib/exchange/binance/binance-testnet-journal";
import {
  enqueueBinanceTestnetPreview,
  loadBinanceTestnetPreviewQueue,
  removeBinanceTestnetQueueItem,
  type BinanceTestnetQueueItem,
} from "@/lib/exchange/binance/binance-preview-queue";
import { BINANCE_TESTNET_SAFETY_NOTICE } from "@/lib/exchange/binance/binance-types";
import type {
  BinanceBalance,
  BinanceOpenOrder,
  BinanceOrderPreview,
  BinanceOrderSide,
  BinancePosition,
  BinanceStatusResult,
  BinanceTestnetJournalEntry,
} from "@/lib/exchange/binance/binance-types";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function BinanceTestnetDashboard() {
  const [status, setStatus] = useState<BinanceStatusResult | null>(null);
  const [balances, setBalances] = useState<BinanceBalance[]>([]);
  const [positions, setPositions] = useState<BinancePosition[]>([]);
  const [orders, setOrders] = useState<BinanceOpenOrder[]>([]);
  const [queue, setQueue] = useState<BinanceTestnetQueueItem[]>([]);
  const [journal, setJournal] = useState<BinanceTestnetJournalEntry[]>([]);
  const [preview, setPreview] = useState<BinanceOrderPreview | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<BinanceOrderSide>("SELL");
  const [notionalUsd, setNotionalUsd] = useState(10);
  const [reason, setReason] = useState("manual testnet pilot");
  const [doubleConfirm, setDoubleConfirm] = useState(false);
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const pushError = (msg: string) => {
    setError(msg);
    setErrorLog((prev) => [msg, ...prev].slice(0, 20));
  };

  const refreshAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [statusRes, accountRes, posRes, journalRes] = await Promise.all([
        fetch("/api/exchange/binance/status", { cache: "no-store" }),
        fetch("/api/exchange/binance/account", { cache: "no-store" }),
        fetch("/api/exchange/binance/positions", { cache: "no-store" }),
        fetch("/api/exchange/binance/journal", { cache: "no-store" }),
      ]);

      const statusData = await statusRes.json();
      const accountData = await accountRes.json();
      const posData = await posRes.json();
      const journalData = await journalRes.json();

      if (statusRes.ok) setStatus(statusData.status);
      if (accountRes.ok) setBalances(accountData.balances ?? []);
      if (posRes.ok) {
        setPositions(posData.positions ?? []);
        setOrders(posData.orders ?? []);
      }
      if (journalRes.ok && Array.isArray(journalData.journal)) {
        const serverJournal = journalData.journal as BinanceTestnetJournalEntry[];
        const clientJournal = loadBinanceTestnetJournalClient();
        const merged = [...clientJournal];
        for (const entry of serverJournal) {
          if (!merged.some((m) => m.binanceTestnetTradeId === entry.binanceTestnetTradeId)) {
            merged.push(entry);
          }
        }
        setJournal(merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        setJournal(loadBinanceTestnetJournalClient());
      }

      if (!statusRes.ok && statusData.error) pushError(statusData.error);
    } catch (e) {
      pushError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setQueue(loadBinanceTestnetPreviewQueue());
    setJournal(loadBinanceTestnetJournalClient());
    void refreshAll();
    const id = setInterval(() => void refreshAll(), 60_000);
    return () => clearInterval(id);
  }, [refreshAll]);

  const buildPreview = async (input?: {
    source?: "ai_signal" | "manual_test";
    symbol?: string;
    side?: BinanceOrderSide;
    notionalUsd?: number;
    reason?: string;
    decisionLogId?: string | null;
  }) => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/exchange/binance/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: input?.source ?? "manual_test",
          symbol: input?.symbol ?? symbol,
          side: input?.side ?? side,
          notionalUsd: input?.notionalUsd ?? notionalUsd,
          reason: input?.reason ?? reason,
          decisionLogId: input?.decisionLogId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
      setStatusMsg(
        data.preview.blocked
          ? `Preview blocked: ${data.preview.blockReasons[0]}`
          : `Preview ready — expires ${new Date(data.preview.expiresAt).toLocaleTimeString()}`,
      );
    } catch (e) {
      pushError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const executePreview = async (p: BinanceOrderPreview) => {
    setBusy(true);
    setError(null);
    try {
      const entries = loadDecisionLog();
      const ordersLocal = loadPaperOrders();
      const governance = loadGovernanceState();
      const res = await fetch("/api/exchange/binance/testnet/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: p.previewId,
          doubleConfirm,
          operatorNote,
          entries,
          orders: ordersLocal,
          governance,
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        appendBinanceTestnetJournalClient(data.journalEntry);
        setJournal(loadBinanceTestnetJournalClient());
      }
      if (!res.ok) throw new Error(data.error ?? data.journalEntry?.blockReasons?.[0] ?? "Execute blocked");
      setStatusMsg(`Testnet order submitted: ${data.exchangeOrderId ?? "pending"}`);
      setDoubleConfirm(false);
      await refreshAll();
    } catch (e) {
      pushError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  };

  const closePosition = async (pos: BinancePosition) => {
    setBusy(true);
    setError(null);
    try {
      const entries = loadDecisionLog();
      const ordersLocal = loadPaperOrders();
      const governance = loadGovernanceState();
      const res = await fetch("/api/exchange/binance/testnet/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: pos.symbol,
          doubleConfirm,
          operatorNote,
          entries,
          orders: ordersLocal,
          governance,
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        appendBinanceTestnetJournalClient(data.journalEntry);
        setJournal(loadBinanceTestnetJournalClient());
      }
      const openTrade = journal.find(
        (j) => j.symbol === pos.symbol && ["SUBMITTED", "FILLED"].includes(j.status),
      );
      if (openTrade && data.ok) {
        updateBinanceTestnetJournalClient(openTrade.binanceTestnetTradeId, {
          status: "CLOSING",
          exchangeOrderId: data.exchangeOrderId,
        });
        setJournal(loadBinanceTestnetJournalClient());
      }
      if (!res.ok) throw new Error(data.error ?? "Close blocked");
      setStatusMsg(`Reduce-only close submitted: ${data.exchangeOrderId}`);
      await refreshAll();
    } catch (e) {
      pushError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(false);
    }
  };

  const usdtBalance = balances.find((b) => b.asset === "USDT");

  return (
    <OpsShell
      badge="TESTNET ONLY"
      title="Binance Futures Testnet"
      subtitle={BINANCE_TESTNET_SAFETY_NOTICE}
      activePath="/binance-testnet"
      accent="cyan"
    >
      <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        Testnet only — BINANCE_LIVE_ENABLED must remain false. No production Binance orders.
      </div>

      {statusMsg && (
        <p className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {statusMsg}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Connection"
          value={status?.connected ? "Connected" : "Disconnected"}
          hint={status?.connected ? "Testnet auth OK" : "Check API keys"}
        />
        <OpsKpi
          label="Testnet enabled"
          value={status?.testnetEnabled ? "Yes" : "No"}
          hint="BINANCE_TESTNET_ENABLED"
        />
        <OpsKpi
          label="USDT balance"
          value={usdtBalance?.availableBalance ?? "—"}
          mono
        />
        <OpsKpi
          label="Open positions"
          value={String(positions.length)}
          hint={`Max ${status?.allowedSymbols?.length ? "1" : "—"} per env`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Connection status">
          <ul className="space-y-1 text-xs text-zinc-400">
            <li>Base URL: {status?.baseUrl ?? "—"}</li>
            <li>Configured: {status?.configured ? "yes" : "no"}</li>
            <li>Live blocked: {status?.liveBlocked ? "yes" : "no"}</li>
            <li>
              Allowed: {(status?.allowedSymbols ?? []).join(", ") || "—"}
            </li>
            <li>Clock skew: {status?.clockSkewMs ?? "—"} ms</li>
            {status?.error && <li className="text-rose-400">{status.error}</li>}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshAll()}
            className="mt-3 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </Panel>

        <Panel title="Safety locks">
          <ul className="space-y-1 text-xs text-zinc-400">
            <li>MARKET orders only · 1x leverage · one-way mode</li>
            <li>Max notional: $10 (env cap)</li>
            <li>Max 1 open position · 5 trades/day</li>
            <li>Double confirmation required before execute</li>
            <li>Kill switch + command center BLOCKED → blocked</li>
          </ul>
        </Panel>

        <Panel title="Order preview form">
          <div className="grid gap-2 text-xs">
            <label className="flex flex-col gap-1 text-zinc-500">
              Symbol
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              >
                {(status?.allowedSymbols ?? ["BTCUSDT", "SOLUSDT"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-zinc-500">
              Side
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as BinanceOrderSide)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              >
                <option value="BUY">BUY (long)</option>
                <option value="SELL">SELL (short)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-zinc-500">
              Notional USD
              <input
                type="number"
                min={1}
                max={10}
                value={notionalUsd}
                onChange={(e) => setNotionalUsd(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-zinc-500">
              Reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void buildPreview()}
              className="mt-1 rounded bg-cyan-800/60 px-3 py-1.5 text-zinc-100 hover:bg-cyan-700/60 disabled:opacity-50"
            >
              Build preview
            </button>
          </div>
        </Panel>

        <Panel title="Preview queue (from cockpit)">
          {queue.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No queued previews — use cockpit &quot;Send to Binance Testnet Preview&quot;.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {queue.map((q) => (
                <li
                  key={q.queueId}
                  className="rounded border border-zinc-800 p-2 text-zinc-300"
                >
                  {q.preview.symbol} {q.preview.side} ${q.preview.notionalUsd}
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview(q.preview)}
                      className="text-cyan-400 hover:underline"
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeBinanceTestnetQueueItem(q.queueId);
                        setQueue(loadBinanceTestnetPreviewQueue());
                      }}
                      className="text-zinc-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {preview && (
          <Panel title="Active preview">
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>ID: {preview.previewId}</li>
              <li>
                {preview.symbol} {preview.side} · qty ~{preview.estimatedQty}
              </li>
              <li>Notional: ${preview.notionalUsd}</li>
              <li>Expires: {new Date(preview.expiresAt).toLocaleString()}</li>
              {preview.blocked && (
                <li className="text-rose-400">
                  Blocked: {preview.blockReasons.join("; ")}
                </li>
              )}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={doubleConfirm}
                onChange={(e) => setDoubleConfirm(e.target.checked)}
              />
              I confirm this testnet order (double confirm)
            </label>
            <input
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              placeholder="Operator note (optional)"
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            />
            <button
              type="button"
              disabled={busy || preview.blocked || !doubleConfirm}
              onClick={() => void executePreview(preview)}
              className="mt-3 rounded bg-emerald-800/50 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-700/50 disabled:opacity-50"
            >
              Execute testnet MARKET order
            </button>
          </Panel>
        )}

        <Panel title="Open positions">
          {positions.length === 0 ? (
            <p className="text-xs text-zinc-500">No open testnet positions.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {positions.map((p) => (
                <li
                  key={p.symbol}
                  className="rounded border border-zinc-800 p-2 text-zinc-300"
                >
                  {p.symbol}: {p.positionAmt} @ {p.entryPrice}
                  <br />
                  uPnL {p.unRealizedProfit} · lev {p.leverage}x
                  <button
                    type="button"
                    disabled={busy || !doubleConfirm}
                    onClick={() => void closePosition(p)}
                    className="mt-2 block rounded border border-amber-800/50 px-2 py-1 text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
                  >
                    Close reduce-only
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open orders">
          {orders.length === 0 ? (
            <p className="text-xs text-zinc-500">No open orders.</p>
          ) : (
            <ul className="space-y-1 text-xs text-zinc-400">
              {orders.map((o) => (
                <li key={o.orderId}>
                  {o.symbol} {o.side} {o.origQty} — {o.status}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Testnet journal">
          {journal.length === 0 ? (
            <p className="text-xs text-zinc-500">No testnet trades journaled yet.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {journal.slice(0, 30).map((j) => (
                <li
                  key={j.binanceTestnetTradeId}
                  className="rounded border border-zinc-800 p-2 text-zinc-400"
                >
                  <span className="text-zinc-200">{j.status}</span> · {j.symbol}{" "}
                  {j.side} ${j.notionalUsd}
                  {j.decisionLogId && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-indigo-400">dec {j.decisionLogId.slice(0, 8)}</span>
                    </>
                  )}
                  <br />
                  {new Date(j.createdAt).toLocaleString()}
                  {j.exchangeOrderId && ` · #${j.exchangeOrderId}`}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Error log">
          {errorLog.length === 0 ? (
            <p className="text-xs text-zinc-500">No errors recorded this session.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-rose-300/80">
              {errorLog.map((e, i) => (
                <li key={`${e}-${i}`}>· {e}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="mt-4 text-xs text-zinc-600">
        <Link href="/" className="text-cyan-500 hover:underline">
          ← Desk cockpit
        </Link>
        {" · "}
        <Link href="/ledger" className="text-cyan-500 hover:underline">
          Unified ledger
        </Link>
      </p>
    </OpsShell>
  );
}

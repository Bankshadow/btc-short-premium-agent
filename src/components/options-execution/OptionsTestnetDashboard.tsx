"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadOptionsPreviewJournal } from "@/lib/options-execution/preview-journal-store";
import {
  appendOptionsTestnetJournal,
  loadOptionsTestnetJournal,
  saveOptionsTestnetJournal,
  updateOptionsTestnetJournalEntry,
} from "@/lib/options-execution/testnet-journal-store";
import {
  enqueueOptionsTestnetPreview,
  loadOptionsTestnetPreviewQueue,
  removeOptionsTestnetQueueItem,
  type OptionsTestnetQueueItem,
} from "@/lib/options-execution/testnet-preview-queue";
import { buildOptionsTestnetClosePreview } from "@/lib/options-execution/build-testnet-close-preview";
import { reconcileOptionsTestnetState } from "@/lib/options-execution/reconcile-testnet-state";
import { OPTIONS_TESTNET_BANNER } from "@/lib/options-execution/testnet-gates";
import type {
  OptionsOrderPreview,
  OptionsTestnetClosePreview,
  OptionsTestnetJournalEntry,
} from "@/lib/options-execution/types";
import type {
  ExchangeOpenOrderSnapshot,
  ExchangePositionSnapshot,
} from "@/lib/exchange/types";

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

function parseExpiryFromSymbol(symbol: string): string | null {
  const match = symbol.match(/BTC-(\d{1,2}[A-Z]{3}\d{2})-/);
  return match?.[1] ?? null;
}

export default function OptionsTestnetDashboard() {
  const [queue, setQueue] = useState<OptionsTestnetQueueItem[]>([]);
  const [journal, setJournal] = useState<OptionsTestnetJournalEntry[]>([]);
  const [orders, setOrders] = useState<ExchangeOpenOrderSnapshot[]>([]);
  const [positions, setPositions] = useState<ExchangePositionSnapshot[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<OptionsOrderPreview | null>(
    null,
  );
  const [closePreview, setClosePreview] =
    useState<OptionsTestnetClosePreview | null>(null);
  const [selectedTrade, setSelectedTrade] =
    useState<OptionsTestnetJournalEntry | null>(null);
  const [operatorNote, setOperatorNote] = useState("");
  const [operatorApproval, setOperatorApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refreshExchange = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const j = loadOptionsTestnetJournal();
      const [posRes, ordRes] = await Promise.all([
        fetch("/api/options/testnet/positions", { cache: "no-store" }),
        fetch("/api/options/testnet/orders", { cache: "no-store" }),
      ]);
      const posData = await posRes.json();
      const ordData = await ordRes.json();

      const nextPositions = posRes.ok ? (posData.positions ?? []) : [];
      const nextOrders = ordRes.ok ? (ordData.orders ?? []) : [];
      setPositions(nextPositions);
      setOrders(nextOrders);

      if (j.length > 0 && posRes.ok && ordRes.ok) {
        const reconcile = reconcileOptionsTestnetState({
          journal: j,
          positions: nextPositions,
          orders: nextOrders,
        });
        saveOptionsTestnetJournal(reconcile.updatedEntries);
        setJournal(reconcile.updatedEntries);
      } else {
        setJournal(j);
      }

      if (!posRes.ok && posData.error) {
        setError(posData.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setQueue(loadOptionsTestnetPreviewQueue());
    setJournal(loadOptionsTestnetJournal());
    void refreshExchange();
    const id = setInterval(() => void refreshExchange(), 60_000);
    return () => clearInterval(id);
  }, [refreshExchange]);

  const executePreview = async (preview: OptionsOrderPreview) => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/options/testnet/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview,
          previewJournal: loadOptionsPreviewJournal(),
          operatorApproval,
          operatorNote,
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        appendOptionsTestnetJournal(data.journalEntry);
        setJournal(loadOptionsTestnetJournal());
      }
      if (!res.ok) throw new Error(data.error ?? "Execute blocked");
      setStatusMsg(
        `Testnet order submitted: ${data.exchangeOrderId ?? data.optionsTestnetTradeId}`,
      );
      await refreshExchange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  };

  const runClose = async () => {
    if (!closePreview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/options/testnet/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closePreview,
          operatorApproval,
          operatorNote,
        }),
      });
      const data = await res.json();
      if (data.journalEntry && selectedTrade) {
        updateOptionsTestnetJournalEntry(selectedTrade.optionsTestnetTradeId, {
          status: "CLOSING",
          exchangeOrderId: data.exchangeOrderId,
        });
        setJournal(loadOptionsTestnetJournal());
      }
      if (!res.ok) throw new Error(data.error ?? "Close blocked");
      setStatusMsg(`Close submitted: ${data.exchangeOrderId}`);
      setClosePreview(null);
      await refreshExchange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(false);
    }
  };

  const buildCloseForTrade = (trade: OptionsTestnetJournalEntry) => {
    const pos = positions.find((p) => p.symbol === trade.symbol);
    const preview = buildOptionsTestnetClosePreview({ trade, position: pos });
    setSelectedTrade(trade);
    setClosePreview(preview);
  };

  const importFromPreviewJournal = () => {
    const entries = loadOptionsPreviewJournal().filter(
      (e) => e.valid && e.status === "PREVIEWED",
    );
    if (entries.length === 0) {
      setError("No valid PREVIEWED entries in preview journal — run preview on desk first.");
      return;
    }
    setStatusMsg(
      `${entries.length} preview journal entries found — rebuild preview from desk Options panel, then queue here.`,
    );
  };

  const openTrades = journal.filter(
    (e) => e.status === "OPEN" || e.status === "SUBMITTED" || e.status === "FILLED",
  );

  return (
    <OpsShell
      badge="MVP 39 · Testnet execution"
      title="BTC Options Testnet"
      subtitle="Testnet-only order execution via Bybit testnet — production options live remains impossible."
      accent="cyan"
      iconLetters="TN"
      activePath="/options-testnet"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/options-live-readiness", label: "Options ready" },
        { href: "/governance", label: "Governance", primary: true },
      ]}
    >
      <p className="rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-4 py-2 text-sm font-medium text-cyan-200">
        {OPTIONS_TESTNET_BANNER}
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <OpsKpi label="Queue" value={String(queue.length)} hint="Ready previews" />
        <OpsKpi label="Open trades" value={String(openTrades.length)} hint="Journal" />
        <OpsKpi label="Positions" value={String(positions.length)} hint="Exchange" />
        <OpsKpi label="Orders" value={String(orders.length)} hint="Exchange" />
      </div>

      {error && (
        <p className="rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {statusMsg && (
        <p className="rounded border border-cyan-900/50 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-300">
          {statusMsg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={operatorApproval}
            onChange={(e) => setOperatorApproval(e.target.checked)}
          />
          Operator approval
        </label>
        <input
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
          placeholder="Operator note (optional)"
          value={operatorNote}
          onChange={(e) => setOperatorNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshExchange()}
          className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Refresh exchange
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={importFromPreviewJournal}
          className="rounded border border-cyan-900/50 px-3 py-1 text-cyan-300 hover:bg-cyan-950/40"
        >
          Check preview journal
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Preview Queue">
          {queue.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Empty — run Options Preview on desk, then paste preview JSON or use
              queue from panel below.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {queue.map((item) => (
                <li
                  key={item.queueId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2"
                >
                  <button
                    type="button"
                    className="text-left text-zinc-200 hover:text-cyan-300"
                    onClick={() => {
                      setSelectedPreview(item.preview);
                      setSelectedTrade(null);
                    }}
                  >
                    {item.label}
                    <span className="ml-2 text-zinc-500">
                      {item.preview.valid ? "valid" : "invalid"} · premium $
                      {item.preview.estimatedPremiumUsd}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !operatorApproval}
                      onClick={() => void executePreview(item.preview)}
                      className="rounded bg-cyan-800/60 px-2 py-1 text-cyan-100 hover:bg-cyan-700/60 disabled:opacity-40"
                    >
                      Execute testnet
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueue(removeOptionsTestnetQueueItem(item.queueId))}
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedPreview && (
            <div className="mt-3 rounded border border-cyan-900/40 bg-cyan-950/10 p-3 text-xs text-zinc-400">
              <p className="font-medium text-zinc-200">
                {selectedPreview.ticket?.optionsInstrument.symbol}
              </p>
              <p>Preview {selectedPreview.previewId}</p>
              <p>Margin est. ${selectedPreview.margin.estimatedMarginUsd}</p>
              <p className="text-zinc-500">{selectedPreview.disclaimer}</p>
            </div>
          )}
        </Panel>

        <Panel title="Testnet Orders">
          {orders.length === 0 ? (
            <p className="text-xs text-zinc-500">No open option orders on testnet.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {orders.map((o) => (
                <li key={o.orderId} className="rounded border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-200">{o.symbol}</span>
                  <span className="ml-2 text-zinc-500">
                    {o.side} {o.qty} @ {o.price} · {o.orderStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Testnet Positions">
          {positions.length === 0 ? (
            <p className="text-xs text-zinc-500">No open option positions.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {positions.map((p) => (
                <li
                  key={p.symbol}
                  className="flex flex-wrap justify-between gap-2 rounded border border-zinc-800 px-3 py-2"
                >
                  <span className="text-zinc-200">
                    {p.symbol} · {p.side} {p.size}
                  </span>
                  <span className="text-zinc-500">
                    mark {p.markPrice} · uPnL {p.unrealisedPnl}
                  </span>
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      const trade = journal.find((j) => j.symbol === p.symbol);
                      if (trade) buildCloseForTrade(trade);
                      else {
                        setError("No journal trade for position — close manually on exchange.");
                      }
                    }}
                  >
                    Close preview
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Expiry Monitor">
          {openTrades.length === 0 ? (
            <p className="text-xs text-zinc-500">No open journal trades to monitor.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {openTrades.map((t) => {
                const expiryCode = parseExpiryFromSymbol(t.symbol);
                return (
                  <li key={t.optionsTestnetTradeId} className="rounded border border-zinc-800 px-3 py-2">
                    <span className="text-zinc-200">{t.symbol}</span>
                    <span className="ml-2 text-amber-400/90">
                      expiry {expiryCode ?? "unknown"}
                    </span>
                    <span className="ml-2 text-zinc-500">status {t.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Close Preview">
          {!closePreview ? (
            <p className="text-xs text-zinc-500">
              Select a position or journal trade to build reduce-only close preview.
            </p>
          ) : (
            <div className="space-y-2 text-xs text-zinc-400">
              <p className="text-zinc-200">{closePreview.symbol}</p>
              <p>
                Close {closePreview.qty} via {closePreview.positionSide === "Sell" ? "Buy" : "Sell"}{" "}
                @ ~{closePreview.estExitPrice}
              </p>
              <p className="text-zinc-500">{closePreview.disclaimer}</p>
              <button
                type="button"
                disabled={busy || !operatorApproval}
                onClick={() => void runClose()}
                className="rounded bg-rose-900/50 px-3 py-1 text-rose-200 hover:bg-rose-800/50 disabled:opacity-40"
              >
                Submit testnet close
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Testnet Journal">
          {journal.length === 0 ? (
            <p className="text-xs text-zinc-500">No testnet trades journaled yet.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
              {journal.map((e) => (
                <li
                  key={e.optionsTestnetTradeId}
                  className="rounded border border-zinc-800 px-3 py-2"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="font-medium text-zinc-200">{e.symbol}</span>
                    <span className="text-cyan-400/80">{e.status}</span>
                  </div>
                  <p className="text-zinc-500">
                    {e.instrument} · qty {e.qty} · premium ${e.premium} · margin $
                    {e.marginEstimateUsd}
                  </p>
                  <p className="text-zinc-600">
                    {e.optionsTestnetTradeId}
                    {e.exchangeOrderId ? ` · ex ${e.exchangeOrderId}` : ""}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-cyan-500 hover:underline"
                    onClick={() => buildCloseForTrade(e)}
                  >
                    Build close
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PreviewJsonImporter
        onImport={(preview) => {
          setQueue(enqueueOptionsTestnetPreview(preview));
          setSelectedPreview(preview);
          setStatusMsg("Preview queued for testnet execution.");
        }}
      />

      <Link href="/" className="text-xs text-cyan-400 hover:underline">
        ← Trading desk · Options Preview panel
      </Link>
    </OpsShell>
  );
}

function PreviewJsonImporter({
  onImport,
}: {
  onImport: (preview: OptionsOrderPreview) => void;
}) {
  const [raw, setRaw] = useState("");

  return (
    <Panel title="Queue preview (JSON)">
      <p className="mb-2 text-xs text-zinc-500">
        Paste an OptionsOrderPreview JSON from desk preview API response to queue.
      </p>
      <textarea
        className="h-24 w-full rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs text-zinc-300"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='{"previewId":"opt-preview-...","valid":true,...}'
      />
      <button
        type="button"
        className="mt-2 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
        onClick={() => {
          try {
            const parsed = JSON.parse(raw) as OptionsOrderPreview;
            if (!parsed.previewId) throw new Error("Missing previewId");
            onImport(parsed);
            setRaw("");
          } catch (e) {
            alert(e instanceof Error ? e.message : "Invalid JSON");
          }
        }}
      >
        Queue preview
      </button>
    </Panel>
  );
}

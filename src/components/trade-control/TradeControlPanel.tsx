"use client";

import { useCallback, useMemo, useState } from "react";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { formatTicketForCopy } from "@/lib/trade-control/build-order-ticket";
import { executeTradeControl } from "@/lib/trade-control/execute-trade-control";
import {
  loadTradeControlSettings,
  saveTradeControlSettings,
} from "@/lib/trade-control/trade-control-settings";
import type {
  ExecutionMode,
  TradeControlActionType,
} from "@/lib/trade-control/trade-control-types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import PreMortemSummary from "@/components/mortem/PreMortemSummary";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";

interface TradeControlPanelProps {
  data: AnalyzeApiResponse;
  logEntry: DecisionLogEntry | null;
  onComplete: () => void;
}

export default function TradeControlPanel({
  data,
  logEntry,
  onComplete,
}: TradeControlPanelProps) {
  const [settings, setSettings] = useState(loadTradeControlSettings);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(
    settings.defaultExecutionMode,
  );
  const [operatorNote, setOperatorNote] = useState("");
  const [sizePct, setSizePct] = useState(
    logEntry?.orderTicket?.positionSizePct ?? 1.75,
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ticket = logEntry?.orderTicket ?? null;
  const control = logEntry?.tradeControl ?? null;
  const pending = control?.status === "PENDING" || control?.status === "MODIFIED";

  const checklist = control?.checklist;

  const patchSettings = useCallback((patch: Partial<typeof settings>) => {
    const next = saveTradeControlSettings(patch);
    setSettings(next);
  }, []);

  const runAction = useCallback(
    async (action: TradeControlActionType) => {
      if (!logEntry || !ticket) return;
      setBusy(true);
      setStatusMsg(null);
      try {
        const result = await executeTradeControl({
          action,
          executionMode,
          operatorNote,
          logEntryId: logEntry.id,
          data,
          ticket: { ...ticket, positionSizePct: sizePct },
          entries: loadDecisionLog(),
          modifiedTicket:
            action === "MODIFY"
              ? { positionSizePct: sizePct }
              : undefined,
        });
        if (!result.ok) {
          setStatusMsg(result.error ?? "Action failed");
          return;
        }
        if (result.copyText) {
          try {
            await navigator.clipboard.writeText(result.copyText);
            setStatusMsg("Copied ticket to clipboard.");
          } catch {
            setStatusMsg("Approved — copy ticket from log.");
          }
        } else if (result.livePlaceholder) {
          setStatusMsg("Live placeholder logged — place order manually off-desk.");
        } else if (result.paperOrder) {
          setStatusMsg(`Paper order opened: ${result.paperOrder.instrument}`);
        } else {
          setStatusMsg("Action logged.");
        }
        onComplete();
      } finally {
        setBusy(false);
      }
    },
    [
      logEntry,
      ticket,
      executionMode,
      operatorNote,
      data,
      sizePct,
      onComplete,
    ],
  );

  const preMortem = data.preMortem ?? logEntry?.preMortem ?? null;
  const preMortemBlocked = preMortemBlocksTicket(preMortem);

  const showPanel = useMemo(() => {
    return data.tradingDesk?.committee.finalVerdict === "TRADE";
  }, [data]);

  if (!showPanel) return null;

  if (preMortemBlocked && preMortem) {
    return <PreMortemSummary preMortem={preMortem} />;
  }

  if (!ticket || !pending) return null;

  return (
    <>
      {preMortem && <PreMortemSummary preMortem={preMortem} />}
    <section className="desk-panel border-2 border-amber-600/50 bg-amber-950/20">
      <div className="border-b border-amber-900/40 px-4 py-3">
        <p className="desk-section-title text-amber-400">Semi-live trade control · MVP 11</p>
        <p className="mt-1 text-xs text-zinc-400">
          Committee TRADE — human approval required before paper or live path. No
          exchange API.
        </p>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-zinc-300">Order ticket</h3>
          <dl className="mt-2 space-y-1.5 font-mono text-[11px] text-zinc-400">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Strategy</dt>
              <dd className="text-zinc-200">{ticket.strategy}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Symbol / side</dt>
              <dd>
                {ticket.symbol} · {ticket.instrument.replace(/_/g, " ")} · {ticket.side}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Entry</dt>
              <dd>${ticket.entryPrice.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">SL / TP</dt>
              <dd>
                {ticket.stopLoss.toLocaleString()}
                {ticket.takeProfit != null
                  ? ` / ${ticket.takeProfit.toLocaleString()}`
                  : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Confidence</dt>
              <dd>
                {ticket.confidence}/100 ({ticket.confidenceLevel})
              </dd>
            </div>
          </dl>
          <ul className="mt-3 list-inside list-disc text-[10px] text-zinc-500">
            {ticket.topReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-600">
            Invalidation: {ticket.invalidation}
          </p>
          <p className="text-[10px] text-zinc-600">Exit: {ticket.forcedExit}</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-300">Pre-trade checklist</h3>
          <ul className="mt-2 space-y-1">
            {checklist?.items.map((item) => (
              <li
                key={item.id}
                className={`text-[11px] ${item.passed ? "text-emerald-400" : "text-rose-400"}`}
              >
                {item.passed ? "✓" : "✗"} {item.label} — {item.detail}
              </li>
            ))}
          </ul>
          {checklist && !checklist.allPassed && (
            <p className="mt-2 text-xs text-rose-400">
              Blocked: {checklist.blockedReason}
            </p>
          )}

          <label className="mt-4 block text-xs text-zinc-500">
            Position size % (modify)
            <input
              type="number"
              step="0.25"
              min="0.25"
              max={settings.maxPositionSizePct}
              value={sizePct}
              onChange={(e) => setSizePct(Number(e.target.value))}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm text-zinc-100"
            />
          </label>

          <label className="mt-3 block text-xs text-zinc-500">
            Execution mode
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="COPY_ONLY">COPY_ONLY — ticket to clipboard</option>
              <option value="PAPER_EXECUTE">PAPER_EXECUTE — open paper book</option>
              <option value="MANUAL_APPROVED_LIVE_PLACEHOLDER">
                MANUAL_APPROVED_LIVE_PLACEHOLDER — log only, you place live
              </option>
            </select>
          </label>

          <label className="mt-3 block text-xs text-zinc-500">
            Operator note (required for Reject / Modify)
            <textarea
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
              placeholder="Reason for decision…"
            />
          </label>

          <label className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">
            <input
              type="checkbox"
              checked={settings.humanApprovalRequired}
              onChange={(e) =>
                patchSettings({ humanApprovalRequired: e.target.checked })
              }
            />
            Require human approval (disables auto paper on TRADE)
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-amber-900/30 px-4 py-3">
        <button
          type="button"
          disabled={busy || !checklist?.allPassed}
          onClick={() => void runAction("APPROVE")}
          className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAction("REJECT")}
          className="rounded bg-rose-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-100"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={busy || !operatorNote.trim()}
          onClick={() => void runAction("MODIFY")}
          className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200"
        >
          Modify size
        </button>
        <button
          type="button"
          disabled={busy || !checklist?.allPassed}
          onClick={() => void runAction("PAPER_ONLY")}
          className="rounded border border-sky-800 bg-sky-950/50 px-3 py-1.5 text-xs text-sky-200"
        >
          Paper only
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void navigator.clipboard.writeText(formatTicketForCopy(ticket));
            setStatusMsg("Ticket copied.");
          }}
          className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        >
          Copy ticket
        </button>
      </div>

      {statusMsg && (
        <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400">
          {statusMsg}
        </p>
      )}

      {control && control.actions.length > 0 && (
        <details className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
          <summary>Action log ({control.actions.length})</summary>
          <ul className="mt-1 space-y-1">
            {control.actions.map((a, i) => (
              <li key={i}>
                {a.timestamp.slice(0, 19)} · {a.action} · {a.executionMode}
                {a.operatorNote ? ` — ${a.operatorNote}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
    </>
  );
}

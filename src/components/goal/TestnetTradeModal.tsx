"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MissionFlowPendingPreview,
  MissionFlowPosition,
} from "@/lib/mission-flow/types";

type Mode = "execute" | "close";

interface TestnetTradeModalProps {
  open: boolean;
  mode: Mode;
  preview?: MissionFlowPendingPreview | null;
  position?: MissionFlowPosition | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TestnetTradeModal({
  open,
  mode,
  preview,
  position,
  onClose,
  onSuccess,
}: TestnetTradeModalProps) {
  const [doubleConfirm, setDoubleConfirm] = useState(false);
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDoubleConfirm(false);
    setOperatorNote("");
    setError(null);
    setStatusMsg(null);
  }, [open, mode, preview?.previewId, position?.symbol]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      if (mode === "execute") {
        if (!preview) throw new Error("No preview to execute");
        const res = await fetch("/api/exchange/binance/testnet/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewId: preview.previewId,
            doubleConfirm: true,
            operatorNote: operatorNote || "mission-ui execute",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(
            data.error ?? data.journalEntry?.blockReasons?.[0] ?? "Execute blocked",
          );
        }
        setStatusMsg(
          `Testnet order submitted${data.exchangeOrderId ? `: ${data.exchangeOrderId}` : ""}.`,
        );
      } else {
        if (!position) throw new Error("No position to close");
        const res = await fetch("/api/exchange/binance/testnet/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: position.symbol,
            doubleConfirm: true,
            operatorNote: operatorNote || "mission-ui close",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Close blocked");
        }
        setStatusMsg(
          `Reduce-only close submitted${data.exchangeOrderId ? `: ${data.exchangeOrderId}` : ""}.`,
        );
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, [mode, preview, position, operatorNote, onSuccess]);

  if (!open) return null;

  const title =
    mode === "execute" ? "Review testnet order" : "Close testnet position";
  const blocked = mode === "execute" && preview?.blocked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="testnet-trade-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-cyan-400/80">
              Testnet only · double confirm
            </p>
            <h2 id="testnet-trade-modal-title" className="mt-1 text-lg font-semibold text-zinc-100">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>

        {mode === "execute" && preview && (
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
            <li>
              <span className="text-zinc-500">Symbol</span>{" "}
              <span className="font-mono text-zinc-200">
                {preview.symbol} {preview.side}
              </span>
            </li>
            <li>
              <span className="text-zinc-500">Notional</span>{" "}
              <span className="font-mono text-zinc-200">${preview.notionalUsd}</span>
            </li>
            <li>
              <span className="text-zinc-500">Qty ~</span>{" "}
              <span className="font-mono text-zinc-200">{preview.estimatedQty}</span>
            </li>
            <li>
              <span className="text-zinc-500">Expires</span>{" "}
              {new Date(preview.expiresAt).toLocaleString()}
            </li>
            {preview.reason && (
              <li>
                <span className="text-zinc-500">Reason</span> {preview.reason}
              </li>
            )}
            {blocked && (
              <li className="text-rose-300">
                Blocked: {preview.blockReasons.join("; ")}
              </li>
            )}
          </ul>
        )}

        {mode === "close" && position && (
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
            <li>
              <span className="text-zinc-500">Position</span>{" "}
              <span className="font-mono text-zinc-200">{position.summary}</span>
            </li>
            <li>
              <span className="text-zinc-500">Symbol</span>{" "}
              <span className="font-mono text-zinc-200">{position.symbol}</span>
            </li>
            <li>
              <span className="text-zinc-500">Unrealized</span>{" "}
              <span className="font-mono text-zinc-200">
                {position.unrealizedPnlUsd >= 0 ? "+" : ""}$
                {position.unrealizedPnlUsd.toFixed(2)}
              </span>
            </li>
          </ul>
        )}

        <p className="mt-4 text-[11px] text-amber-200/90">
          Practice money only. Live trading stays locked. MARKET order · reduce-only on close.
        </p>

        <label className="mt-4 flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={doubleConfirm}
            onChange={(e) => setDoubleConfirm(e.target.checked)}
          />
          I confirm this testnet action (double confirm)
        </label>

        <input
          value={operatorNote}
          onChange={(e) => setOperatorNote(e.target.value)}
          placeholder="Operator note (optional)"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
        />

        {error && (
          <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
        {statusMsg && (
          <p className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            {statusMsg}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || !doubleConfirm || blocked}
            onClick={() => void submit()}
            className="flex-1 rounded-lg bg-emerald-700/90 px-4 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy
              ? "Submitting…"
              : mode === "execute"
                ? "Execute testnet order"
                : "Close position"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

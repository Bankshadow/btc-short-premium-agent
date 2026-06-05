"use client";

import { useState } from "react";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { LiveExecuteResult, OrderPreviewResult } from "@/lib/exchange/types";

interface ExchangePreviewPanelProps {
  preview: OrderPreviewResult | null;
  loading?: boolean;
  onClose?: () => void;
  perpSignal?: PerpDirectionalSignal | null;
  onExecuted?: (result: LiveExecuteResult) => void;
}

export default function ExchangePreviewPanel({
  preview,
  loading,
  onClose,
  perpSignal,
  onExecuted,
}: ExchangePreviewPanelProps) {
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<LiveExecuteResult | null>(
    null,
  );
  const [doubleConfirm, setDoubleConfirm] = useState(false);

  async function handleLiveExecute() {
    if (!preview?.valid || !perpSignal || !preview.executeConfirmToken) return;
    setExecuting(true);
    setExecuteResult(null);
    try {
      const res = await fetch("/api/exchange/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: perpSignal,
          confirmToken: preview.executeConfirmToken,
          confirmExpiresAt: preview.executeConfirmExpiresAt,
          doubleConfirm,
          operatorNote: "UI live execute MVP 34",
        }),
      });
      const data = (await res.json()) as LiveExecuteResult;
      setExecuteResult(data);
      onExecuted?.(data);
    } catch {
      setExecuteResult({
        ok: false,
        orderId: null,
        symbol: preview.symbol,
        side: preview.side,
        qty: preview.estQty,
        network: preview.network,
        testnet: preview.network === "testnet",
        timestamp: new Date().toISOString(),
        operatorNote: "",
        auditId: "",
        error: "Execute request failed",
      });
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-3 py-3 text-xs text-cyan-200/80">
        Building exchange preview…
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="mt-3 rounded-lg border border-cyan-900/50 bg-zinc-950/80 px-3 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-cyan-200">
          Exchange preview · {preview.category}{" "}
          <span
            className={
              preview.valid
                ? "text-emerald-400"
                : "text-rose-400"
            }
          >
            {preview.valid ? "VALID" : "REJECTED"}
          </span>
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <p className="text-[10px] text-zinc-600">Symbol / Side</p>
          <p className="font-mono text-zinc-200">
            {preview.symbol || "—"} · {preview.side || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600">Est. notional</p>
          <p className="font-mono text-zinc-200">${preview.estNotionalUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600">Qty / Fee</p>
          <p className="font-mono text-zinc-200">
            {preview.estQty} · ~${preview.estFeeUsd.toFixed(4)} fee
          </p>
        </div>
      </div>

      {preview.availableBalanceUsd !== null && (
        <p className="mt-2 text-zinc-500">
          Available USDT: ${preview.availableBalanceUsd.toFixed(2)}
          {preview.marginSufficient === false && (
            <span className="text-rose-400"> · margin insufficient</span>
          )}
        </p>
      )}

      {preview.rejectReasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-rose-300">
          {preview.rejectReasons.map((r) => (
            <li key={r}>✗ {r}</li>
          ))}
        </ul>
      )}

      {preview.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-amber-300/90">
          {preview.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] text-zinc-500">
          Bybit payload (dry-run)
        </summary>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-zinc-400">
          {JSON.stringify(preview.bybitPayload, null, 2)}
        </pre>
      </details>

      {preview.valid && perpSignal && preview.executeConfirmToken && (
        <div className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
          <p className="text-[10px] font-medium text-amber-200">
            MVP 34 live execute (requires LIVE_EXECUTION_ENABLED + double confirm)
          </p>
          <label className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
            <input
              type="checkbox"
              checked={doubleConfirm}
              onChange={(e) => setDoubleConfirm(e.target.checked)}
              className="accent-amber-500"
            />
            I confirm live order on {preview.network ?? "exchange"}
          </label>
          <button
            type="button"
            disabled={executing || !doubleConfirm}
            onClick={() => void handleLiveExecute()}
            className="mt-2 rounded bg-amber-800/80 px-3 py-1 text-[10px] font-semibold text-amber-100 disabled:opacity-40"
          >
            {executing ? "Placing…" : "Execute live perp"}
          </button>
        </div>
      )}

      {executeResult && (
        <p
          className={`mt-2 text-[11px] ${executeResult.ok ? "text-emerald-400" : "text-rose-400"}`}
        >
          {executeResult.ok
            ? `Order placed: ${executeResult.orderId}`
            : executeResult.error}
        </p>
      )}

      <p className="mt-2 text-[10px] text-zinc-600">{preview.disclaimer}</p>
    </div>
  );
}

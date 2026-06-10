"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import type { ClosePreview } from "@/lib/execution/close-preview-types";
import type { CloseSafetyResult } from "@/lib/execution/close-safety-gate";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";

interface ExecuteCloseResult {
  ok: boolean;
  blocked: boolean;
  message: string;
  orderId: string | null;
  tradeId: string | null;
  closePreviewId: string | null;
  positionClosed: boolean;
  blockers: Array<{ code: string; message: string }>;
}

interface CloseReviewModalProps {
  tradeId: string;
  symbol: string;
  side: string;
  qty: string;
  onClose: () => void;
  onReviewed: () => void;
}

export function CloseReviewModal({
  tradeId,
  symbol,
  side,
  qty,
  onClose,
  onReviewed,
}: CloseReviewModalProps) {
  const [confirm, setConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [safety, setSafety] = useState<CloseSafetyResult | null>(null);
  const [closeResult, setCloseResult] = useState<ExecuteCloseResult | null>(null);
  const [binanceStatus, setBinanceStatus] = useState<BinanceTestnetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBinanceStatus() {
    const status = await fetchJson<BinanceTestnetStatus>("/api/binance/status");
    setBinanceStatus(status);
    return status;
  }

  async function createPreview() {
    setCreating(true);
    setError(null);
    setSafety(null);
    setCloseResult(null);
    try {
      const [res] = await Promise.all([
        fetchJson<{
          ok: boolean;
          preview: ClosePreview | null;
          message: string;
          blockReasons: string[];
        }>("/api/execution/testnet/close-preview", {
          method: "POST",
          body: JSON.stringify({ tradeId }),
        }),
        loadBinanceStatus(),
      ]);
      if (res.preview) {
        setPreview(res.preview);
        if (!res.ok) {
          setError(res.message);
        }
      } else {
        setError(res.message);
      }
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close preview failed");
    } finally {
      setCreating(false);
    }
  }

  async function runCloseReview() {
    if (!preview) return;
    setReviewing(true);
    setError(null);
    setCloseResult(null);
    try {
      const res = await fetchJson<CloseSafetyResult>("/api/execution/testnet/close-review", {
        method: "POST",
        body: JSON.stringify({
          closePreviewId: preview.closePreviewId,
          doubleConfirm: confirm,
        }),
      });
      setSafety(res);
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close review failed");
    } finally {
      setReviewing(false);
    }
  }

  async function runCloseExecute() {
    if (!preview) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetchJson<ExecuteCloseResult>("/api/execution/testnet/close", {
        method: "POST",
        body: JSON.stringify({
          closePreviewId: preview.closePreviewId,
          doubleConfirm: true,
        }),
      });
      setCloseResult(res);
      if (res.ok) onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close execution failed");
    } finally {
      setExecuting(false);
    }
  }

  const blockers = closeResult?.blockers ?? safety?.blockers ?? [];
  const warnings = safety?.warnings ?? [];
  const binanceConnected = binanceStatus?.status === "CONNECTED";
  const canExecute =
    preview &&
    preview.status === "ACTIVE" &&
    !preview.blocked &&
    safety?.allowed === true &&
    confirm &&
    binanceConnected &&
    !executing &&
    !closeResult?.ok;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto">
        <h3 className="text-lg font-bold">Reduce-only close</h3>

        <div className="space-y-1 text-sm">
          <p>
            {symbol} {side} · qty {qty}
          </p>
          <p className="text-[var(--muted)]">Environment: TESTNET · Live locked</p>
          <p className="text-[var(--muted)]">Order type: MARKET · reduceOnly: true</p>
          <p className="text-xs text-[var(--muted)]">tradeId: {tradeId}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I confirm reduce-only close on testnet — no reverse position.
        </label>

        {binanceStatus ? (
          <p className="text-xs text-[var(--muted)]">
            Binance: {binanceStatus.status} — {binanceStatus.reason}
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-1 rounded border border-[var(--border)] p-3 text-sm">
            <p className="font-medium">Close preview</p>
            <p>
              Close side: <strong>{preview.sideToClose}</strong> · qty {preview.qty}
            </p>
            <p className="text-[var(--muted)]">
              Status: {preview.status} · expires {new Date(preview.expiresAt).toLocaleString()}
            </p>
            {preview.blocked ? (
              <ul className="list-inside list-disc text-[var(--danger)]">
                {preview.blockReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {safety ? (
          <div
            className={`rounded border p-3 text-sm ${
              safety.allowed
                ? "border-[var(--success)]/40 bg-[var(--success)]/5"
                : "border-[var(--danger)]/40 bg-[var(--danger)]/5"
            }`}
          >
            <p className="font-medium">{safety.message}</p>
          </div>
        ) : null}

        {closeResult?.ok ? (
          <div className="rounded border border-[var(--success)]/40 bg-[var(--success)]/5 p-3 text-sm">
            <p className="font-medium text-[var(--success)]">{closeResult.message}</p>
            <p className="text-[var(--muted)]">orderId: {closeResult.orderId ?? "—"}</p>
            <p className="text-[var(--muted)]">
              positionClosed: {closeResult.positionClosed ? "yes" : "no (partial or refresh pending)"}
            </p>
          </div>
        ) : null}

        {blockers.length > 0 && !closeResult?.ok ? (
          <ul className="list-inside list-disc text-sm text-[var(--danger)]">
            {blockers.map((b) => (
              <li key={b.code}>
                {b.code}: {b.message}
              </li>
            ))}
          </ul>
        ) : null}

        {warnings.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-[var(--muted)]">
            {warnings.map((w) => (
              <li key={w.code}>
                {w.code}: {w.message}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={creating || reviewing || executing}
          >
            {closeResult?.ok ? "Done" : "Close"}
          </button>
          {!preview ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating}
              onClick={createPreview}
            >
              {creating ? "Creating preview…" : "Create close preview"}
            </button>
          ) : closeResult?.ok ? null : !safety?.allowed ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={reviewing || preview.blocked}
              onClick={runCloseReview}
            >
              {reviewing ? "Reviewing…" : "Run close safety review"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canExecute}
              onClick={runCloseExecute}
            >
              {executing ? "Executing…" : "Execute reduce-only close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

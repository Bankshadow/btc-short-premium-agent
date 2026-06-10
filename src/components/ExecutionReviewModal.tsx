"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import type { OrderPreview } from "@/lib/execution/preview-types";
import type { ExecutionSafetyResult } from "@/lib/execution/execution-safety-types";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";

interface ExecuteTestnetResult {
  ok: boolean;
  blocked: boolean;
  message: string;
  orderId: string | null;
  tradeId: string | null;
  blockers: Array<{ code: string; message: string }>;
}

interface ExecutionReviewModalProps {
  preview: OrderPreview;
  onClose: () => void;
  onReviewed: () => void;
}

export function ExecutionReviewModal({
  preview,
  onClose,
  onReviewed,
}: ExecutionReviewModalProps) {
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionSafetyResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteTestnetResult | null>(null);
  const [binanceStatus, setBinanceStatus] = useState<BinanceTestnetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBinanceStatus() {
    const status = await fetchJson<BinanceTestnetStatus & { status: string }>("/api/binance/status");
    setBinanceStatus(status);
    return status;
  }

  async function runReview() {
    setSubmitting(true);
    setError(null);
    setExecuteResult(null);
    try {
      const [res] = await Promise.all([
        fetchJson<ExecutionSafetyResult>("/api/execution/review", {
          method: "POST",
          body: JSON.stringify({
            previewId: preview.previewId,
            doubleConfirm: confirm,
          }),
        }),
        loadBinanceStatus(),
      ]);
      setResult(res);
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function runExecute() {
    setExecuting(true);
    setError(null);
    try {
      const res = await fetchJson<ExecuteTestnetResult>("/api/execution/testnet/execute", {
        method: "POST",
        body: JSON.stringify({
          previewId: preview.previewId,
          doubleConfirm: confirm,
        }),
      });
      setExecuteResult(res);
      if (res.ok) onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execute failed");
    } finally {
      setExecuting(false);
    }
  }

  const blockers = result?.blockers ?? executeResult?.blockers ?? [];
  const allowed = result?.allowed ?? false;
  const binanceConnected = binanceStatus?.status === "CONNECTED";
  const canExecute = allowed && binanceConnected && confirm && !executing && !executeResult?.ok;

  const actionLabel = executeResult?.ok
    ? "Testnet order executed"
    : result
      ? allowed
        ? binanceConnected
          ? "Execute on testnet"
          : "Binance not connected"
        : "Resolve blockers first"
      : confirm
        ? "Run execution safety review"
        : "Confirm to review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto">
        <h3 className="text-lg font-bold">Execution safety review</h3>

        <div className="space-y-1 text-sm">
          <p>
            {preview.symbol} {preview.side} · ${preview.notionalUsd} · {preview.orderType}
          </p>
          <p className="text-[var(--muted)]">Qty {preview.estimatedQty}</p>
          <p className="text-[var(--muted)]">Environment: TESTNET · Live locked</p>
          <p className="text-[var(--muted)]">
            Expires {new Date(preview.expiresAt).toLocaleString()}
          </p>
          <p className="text-xs text-[var(--muted)]">decisionLogId: {preview.decisionLogId}</p>
          <p className="text-xs text-[var(--muted)]">previewId: {preview.previewId}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I confirm this is testnet only and I accept the preview details.
        </label>

        {binanceStatus ? (
          <p className="text-xs text-[var(--muted)]">
            Binance: {binanceStatus.status} — {binanceStatus.reason}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-2">
            <p
              className={`text-sm font-medium ${allowed ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
            >
              {result.message}
            </p>
            {blockers.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-[var(--danger)]">
                {blockers.map((b) => (
                  <li key={b.code}>
                    {b.code}: {b.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.warnings.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-[var(--muted)]">
                {result.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {executeResult?.ok ? (
          <div className="rounded border border-[var(--success)]/40 bg-[var(--success)]/5 p-3 text-sm">
            <p className="font-medium text-[var(--success)]">Testnet order executed</p>
            <p className="text-[var(--muted)]">orderId: {executeResult.orderId ?? "—"}</p>
            <p className="text-[var(--muted)]">tradeId: {executeResult.tradeId ?? "—"}</p>
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={submitting || executing}>
            Close
          </button>
          {!result ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!confirm || submitting}
              onClick={runReview}
            >
              {submitting ? "Reviewing…" : actionLabel}
            </button>
          ) : executeResult?.ok ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          ) : allowed ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canExecute}
              onClick={runExecute}
            >
              {executing ? "Executing…" : actionLabel}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled>
              Resolve blockers first
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  ExecutionErrorRow,
  ExecutionLatencyPoint,
  ExecutionQualityInput,
  ExecutionQualityStrategyRow,
  ExecutionQualitySummary,
  ExecutionQualitySymbolRow,
} from "./types";

function n(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Number(((num / den) * 100).toFixed(2));
}

function hourBucket(ts: string): string {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "unknown";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:00Z`;
}

function inferStrategyId(symbol: string, side: string): StrategyId {
  const upper = symbol.toUpperCase();
  const sideUpper = side.toUpperCase();
  if (upper.includes("ETH")) return "eth_btc";
  if (sideUpper === "SELL" || sideUpper.includes("SHORT")) return "futures_short";
  return "futures_long";
}

function hasRejectedStatus(status: string): boolean {
  return status === "FAILED" || status === "BLOCKED";
}

function hasCloseAttempt(entry: {
  closeAttempt?: boolean;
  binanceTestnetTradeId: string;
}): boolean {
  if (entry.closeAttempt) return true;
  return entry.binanceTestnetTradeId.includes("-close");
}

export function buildExecutionQualitySummary(
  input: ExecutionQualityInput,
): ExecutionQualitySummary {
  const testnet = input.testnetJournal ?? [];
  const liveSynthetic = (input.liveTrades ?? []).map((t) => {
    const previewPrice = t.entry?.price ?? null;
    const fillPrice = t.entry?.price ?? null;
    const latencyMs =
      t.executedAt && t.createdAt
        ? Math.max(0, Date.parse(t.executedAt) - Date.parse(t.createdAt))
        : null;
    const slippageRaw = t.slippage ?? null;
    const slippageBps =
      slippageRaw != null && previewPrice && previewPrice !== 0
        ? Number(((slippageRaw / previewPrice) * 10_000).toFixed(3))
        : null;
    return {
      binanceTestnetTradeId: t.liveTradeId,
      previewId: t.previewId,
      symbol: t.symbol,
      side: t.side.toUpperCase().includes("SELL") ? "SELL" : "BUY",
      status:
        t.status === "FAILED" || t.status === "BLOCKED"
          ? ("FAILED" as const)
          : ("SUBMITTED" as const),
      blockReasons: t.error ? [t.error] : [],
      reason: t.error ?? "live-trade",
      fees: t.fees ?? 0,
      slippage: slippageRaw,
      slippageBps,
      latencyMs,
      partialFill: false,
      duplicateSubmission: false,
      retryCount: 0,
      closeAttempt: Boolean(t.exit) || t.status === "FAILED",
      closeFailed: t.status === "FAILED",
      createdAt: t.createdAt,
    };
  });
  const submitAttempts = [...testnet, ...liveSynthetic].filter(
    (e) => e.status !== "PREVIEWED",
  );
  const closeAttempts = submitAttempts.filter((e) => hasCloseAttempt(e));
  const rejectedCount = submitAttempts.filter((e) => hasRejectedStatus(e.status)).length;
  const closeFailedCount = closeAttempts.filter(
    (e) => hasRejectedStatus(e.status) || e.closeFailed === true,
  ).length;
  const partialFillCount = submitAttempts.filter((e) => e.partialFill === true).length;
  const duplicateSubmissionCount =
    submitAttempts.filter((e) => e.duplicateSubmission === true).length +
    [...new Set(submitAttempts.map((e) => e.previewId))]
      .map((previewId) => submitAttempts.filter((e) => e.previewId === previewId).length)
      .filter((count) => count > 1).length;
  const retryCountTotal = submitAttempts.reduce((s, e) => s + (e.retryCount ?? 0), 0);
  const fees = submitAttempts.reduce((s, e) => s + n(e.fees), 0);
  const slippageValues = submitAttempts
    .map((e) => e.slippageBps)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const latencyValues = submitAttempts
    .map((e) => e.latencyMs)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);

  const symbolMap = new Map<string, typeof submitAttempts>();
  for (const row of submitAttempts) {
    const key = row.symbol.toUpperCase();
    const list = symbolMap.get(key) ?? [];
    list.push(row);
    symbolMap.set(key, list);
  }
  const slippageBySymbol: ExecutionQualitySymbolRow[] = [...symbolMap.entries()]
    .map(([symbol, rows]) => {
      const symbolClose = rows.filter((r) => hasCloseAttempt(r));
      const symbolRejected = rows.filter((r) => hasRejectedStatus(r.status)).length;
      const symbolPartial = rows.filter((r) => r.partialFill === true).length;
      const symbolSlippage = rows
        .map((r) => r.slippageBps)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const symbolLatency = rows
        .map((r) => r.latencyMs)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const symbolCloseFailed = symbolClose.filter(
        (r) => hasRejectedStatus(r.status) || r.closeFailed === true,
      ).length;
      return {
        symbol,
        attempts: rows.length,
        avgSlippageBps: avg(symbolSlippage),
        rejectionRatePct: pct(symbolRejected, rows.length),
        failedCloseRatePct: pct(symbolCloseFailed, symbolClose.length),
        partialFillRatePct: pct(symbolPartial, rows.length),
        avgLatencyMs: avg(symbolLatency),
        feeImpactUsd: Number(rows.reduce((s, r) => s + n(r.fees), 0).toFixed(4)),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  const bucketMap = new Map<string, number[]>();
  for (const row of submitAttempts) {
    const latency = row.latencyMs;
    if (latency == null || !Number.isFinite(latency)) continue;
    const bucket = hourBucket(row.createdAt);
    const list = bucketMap.get(bucket) ?? [];
    list.push(latency);
    bucketMap.set(bucket, list);
  }
  const latencyTrend: ExecutionLatencyPoint[] = [...bucketMap.entries()]
    .map(([bucket, values]) => ({
      bucket,
      avgLatencyMs: avg(values),
      attempts: values.length,
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .slice(-24);

  const errorMap = new Map<string, ExecutionErrorRow>();
  for (const row of submitAttempts) {
    if (!hasRejectedStatus(row.status)) continue;
    const messages = row.blockReasons.length
      ? row.blockReasons
      : [row.reason || "unknown execution error"];
    for (const msg of messages) {
      const key = msg.trim().toLowerCase();
      const prev = errorMap.get(key);
      if (!prev) {
        errorMap.set(key, {
          error: msg,
          count: 1,
          lastSeenAt: row.createdAt,
          symbol: row.symbol ?? null,
        });
        continue;
      }
      prev.count += 1;
      if (row.createdAt > prev.lastSeenAt) {
        prev.lastSeenAt = row.createdAt;
        prev.symbol = row.symbol ?? prev.symbol;
      }
      errorMap.set(key, prev);
    }
  }
  const exchangeErrors = [...errorMap.values()].sort((a, b) => b.count - a.count);

  const strategyMap = new Map<StrategyId, typeof submitAttempts>();
  for (const row of submitAttempts) {
    const sid = inferStrategyId(row.symbol, row.side);
    const list = strategyMap.get(sid) ?? [];
    list.push(row);
    strategyMap.set(sid, list);
  }
  const byStrategy: ExecutionQualityStrategyRow[] = [...strategyMap.entries()]
    .map(([strategyId, rows]) => {
      const rejected = rows.filter((r) => hasRejectedStatus(r.status)).length;
      const slippage = rows
        .map((r) => r.slippageBps)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const rejectionRatePct = pct(rejected, rows.length);
      return {
        strategyId,
        attempts: rows.length,
        avgSlippageBps: avg(slippage),
        rejectionRatePct,
        reliabilityPct: Number(Math.max(0, 100 - rejectionRatePct - Math.max(0, avg(slippage) - 8)).toFixed(2)),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  const averageSlippageBps = avg(slippageValues);
  const averageLatencyMs = avg(latencyValues);
  const rejectionRatePct = pct(rejectedCount, submitAttempts.length);
  const failedCloseRatePct = pct(closeFailedCount, closeAttempts.length);
  const partialFillRatePct = pct(partialFillCount, submitAttempts.length);

  const gateReasons: string[] = [];
  if (rejectionRatePct >= 20) gateReasons.push(`Rejection rate too high (${rejectionRatePct}%).`);
  if (failedCloseRatePct >= 10) {
    gateReasons.push(`Failed close rate too high (${failedCloseRatePct}%).`);
  }
  if (averageSlippageBps >= 25) {
    gateReasons.push(`Average slippage too high (${averageSlippageBps} bps).`);
  }
  if (averageLatencyMs >= 8_000) {
    gateReasons.push(`Execution latency too high (${Math.round(averageLatencyMs)} ms).`);
  }
  if (duplicateSubmissionCount > 0) {
    gateReasons.push(`Duplicate submissions detected (${duplicateSubmissionCount}).`);
  }
  const gateStatus: ExecutionQualitySummary["liveQualityGate"]["status"] =
    gateReasons.length >= 2
      ? "FAIL"
      : gateReasons.length === 1
        ? "WARNING"
        : "PASS";

  return {
    generatedAt: new Date().toISOString(),
    averageSlippageBps,
    averageLatencyMs,
    rejectionRatePct,
    failedCloseRatePct,
    partialFillRatePct,
    duplicateSubmissionCount,
    retryCountTotal,
    feeImpactUsd: Number(fees.toFixed(4)),
    failedOrderCount: rejectedCount,
    closeFailureCount: closeFailedCount,
    slippageBySymbol,
    latencyTrend,
    exchangeErrors,
    byStrategy,
    liveQualityGate: {
      status: gateStatus,
      reasons: gateReasons,
      blocksLiveReadiness: gateStatus === "FAIL",
    },
    safetyNotice:
      "Execution Quality Monitor is read-only telemetry. It cannot submit, close, or modify orders.",
  };
}


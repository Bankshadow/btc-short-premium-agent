import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { loadFailedAutomationJobs } from "@/lib/automation-control-plane";
import { loadServerBackboneRecord } from "@/lib/background-worker/server-backbone";
import {
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "@/lib/exchange/binance/binance-config";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { buildObservabilitySnapshot } from "@/lib/observability";
import { loadServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import { isIncidentOpen, loadAnomalyIncidents, upsertAnomalyFindings } from "./store";
import { filterBlockingCriticalIncidents } from "./testnet-gate";
import type { AnomalyDetectionSummary, AnomalyFinding } from "./types";

let cachedSummary: AnomalyDetectionSummary | null = null;
let cachedAt = 0;
const CACHE_MS = 15_000;

function fingerprint(type: AnomalyFinding["anomalyType"], key: string): string {
  return `${type}:${key}`;
}

function numericQty(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function minutesSince(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = Date.now() - Date.parse(timestamp);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 60_000));
}

function add(
  findings: AnomalyFinding[],
  finding: Omit<AnomalyFinding, "fingerprint"> & { fingerprintKey: string },
) {
  findings.push({
    anomalyType: finding.anomalyType,
    severity: finding.severity,
    title: finding.title,
    evidence: finding.evidence,
    impactedModules: finding.impactedModules,
    recommendedAction: finding.recommendedAction,
    fingerprint: fingerprint(finding.anomalyType, finding.fingerprintKey),
  });
}

function detectExchangeDisconnected(
  findings: AnomalyFinding[],
  connected: boolean,
  configured: boolean,
  error: string | null | undefined,
) {
  if (!configured || connected) return;
  add(findings, {
    anomalyType: "exchange_disconnected",
    severity: "CRITICAL",
    title: "Exchange disconnected",
    evidence: { configured, connected, error: error ?? null },
    impactedModules: ["Cockpit", "Command Center", "Worker", "Testnet Monitor"],
    recommendedAction:
      "Verify API keys, proxy/network path, and exchange connectivity before resuming actions.",
    fingerprintKey: error ?? "disconnected",
  });
}

function detectExecutedWithoutLedger(
  findings: AnomalyFinding[],
  journal: BinanceTestnetJournalEntry[],
  backboneTrades: Array<{
    tradeId: string;
    decisionId: string;
    instrument: string;
    openedAt: string;
  }>,
) {
  const executed = journal.filter(
    (item) =>
      ["SUBMITTED", "FILLED", "CLOSING", "CLOSED"].includes(item.status) &&
      item.exchangeOrderId,
  );
  const missing = executed.filter((item) => {
    return !backboneTrades.some((trade) => {
      if (item.decisionLogId && trade.decisionId === item.decisionLogId) return true;
      if (trade.tradeId === item.binanceTestnetTradeId) return true;
      if (trade.instrument !== item.symbol) return false;
      return Math.abs(Date.parse(trade.openedAt) - Date.parse(item.createdAt)) < 10 * 60_000;
    });
  });
  if (missing.length === 0) return;
  add(findings, {
    anomalyType: "order_executed_no_ledger_entry",
    severity: missing.length >= 2 ? "CRITICAL" : "WARNING",
    title: "Order executed but no ledger entry",
    evidence: {
      affected: missing.slice(0, 8).map((item) => ({
        tradeId: item.binanceTestnetTradeId,
        exchangeOrderId: item.exchangeOrderId,
        symbol: item.symbol,
        createdAt: item.createdAt,
      })),
      count: missing.length,
    },
    impactedModules: ["Ledger", "Worker", "Testnet Monitor"],
    recommendedAction:
      "Reconcile journal to ledger and replay missing append-only ledger entries for executed orders.",
    fingerprintKey: missing
      .slice(0, 5)
      .map((item) => item.binanceTestnetTradeId)
      .join(","),
  });
}

function detectLedgerWithoutExchange(
  findings: AnomalyFinding[],
  openTradeSymbols: string[],
  backboneOpenTestnetSymbols: string[],
) {
  const exchangeSet = new Set(openTradeSymbols);
  const missing = backboneOpenTestnetSymbols.filter((symbol) => !exchangeSet.has(symbol));
  if (missing.length === 0) return;
  add(findings, {
    anomalyType: "ledger_entry_no_exchange_order",
    severity: "WARNING",
    title: "Ledger entry exists but no exchange order/position",
    evidence: { symbols: missing, count: missing.length },
    impactedModules: ["Ledger", "Testnet Monitor", "Command Center"],
    recommendedAction:
      "Inspect orphan ledger symbols and either close/reconcile them or append correction entries.",
    fingerprintKey: missing.join(","),
  });
}

function detectPositionSizeMismatch(
  findings: AnomalyFinding[],
  snapshot: TestnetMonitorSnapshot | null,
  journal: BinanceTestnetJournalEntry[],
) {
  if (!snapshot) return;
  const journalBySymbol = new Map<string, number>();
  for (const item of journal) {
    if (!["SUBMITTED", "FILLED", "CLOSING"].includes(item.status)) continue;
    const qty = numericQty(item.quantity);
    if (qty <= 0) continue;
    if (!journalBySymbol.has(item.symbol)) {
      journalBySymbol.set(item.symbol, qty);
    }
  }
  const mismatches = snapshot.openPositions
    .map((pos) => {
      const expected = journalBySymbol.get(pos.symbol);
      if (!expected) return null;
      const actual = numericQty(pos.qty);
      const diff = Math.abs(actual - expected);
      const rel = expected > 0 ? diff / expected : 0;
      if (diff < 0.0001 || rel < 0.15) return null;
      return { symbol: pos.symbol, actual, expected, relDiffPct: Number((rel * 100).toFixed(1)) };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (mismatches.length === 0) return;
  add(findings, {
    anomalyType: "position_size_mismatch",
    severity: "WARNING",
    title: "Position size mismatch",
    evidence: { mismatches },
    impactedModules: ["Testnet Monitor", "Ledger", "Risk Replay"],
    recommendedAction:
      "Re-pull exchange positions and verify fill quantity math before further action.",
    fingerprintKey: mismatches.map((item) => `${item.symbol}:${item.relDiffPct}`).join(","),
  });
}

function detectDuplicateOrder(
  findings: AnomalyFinding[],
  journal: BinanceTestnetJournalEntry[],
) {
  const byExchangeOrder = new Map<string, BinanceTestnetJournalEntry[]>();
  const byPreview = new Map<string, BinanceTestnetJournalEntry[]>();
  for (const item of journal) {
    if (item.exchangeOrderId) {
      const list = byExchangeOrder.get(item.exchangeOrderId) ?? [];
      list.push(item);
      byExchangeOrder.set(item.exchangeOrderId, list);
    }
    const byPrev = byPreview.get(item.previewId) ?? [];
    byPrev.push(item);
    byPreview.set(item.previewId, byPrev);
  }
  const duplicateExchange = [...byExchangeOrder.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([orderId, list]) => ({
      orderId,
      symbols: [...new Set(list.map((item) => item.symbol))],
      count: list.length,
    }));

  const duplicatePreviewExec = [...byPreview.entries()]
    .filter(
      ([, list]) =>
        list.filter((item) =>
          ["SUBMITTED", "FILLED", "CLOSING", "CLOSED"].includes(item.status),
        ).length > 1,
    )
    .map(([previewId, list]) => ({
      previewId,
      count: list.length,
      symbols: [...new Set(list.map((item) => item.symbol))],
    }));

  if (duplicateExchange.length === 0 && duplicatePreviewExec.length === 0) return;
  add(findings, {
    anomalyType: "duplicate_order",
    severity: duplicatePreviewExec.length > 0 ? "CRITICAL" : "WARNING",
    title: "Duplicate order detected",
    evidence: {
      duplicateExchangeOrders: duplicateExchange,
      duplicatePreviewExecutions: duplicatePreviewExec,
    },
    impactedModules: ["Testnet Monitor", "Worker", "Notifications"],
    recommendedAction:
      "Pause auto-execute path and deduplicate order submissions by preview/order idempotency keys.",
    fingerprintKey: JSON.stringify({
      e: duplicateExchange.map((item) => item.orderId),
      p: duplicatePreviewExec.map((item) => item.previewId),
    }),
  });
}

function detectStaleMarketData(
  findings: AnomalyFinding[],
  lastAnalysisAt: string | null,
) {
  const ageMin = minutesSince(lastAnalysisAt);
  if (ageMin == null || ageMin < 10) return;
  add(findings, {
    anomalyType: "stale_market_data",
    severity: ageMin >= 30 ? "CRITICAL" : "WARNING",
    title: "Stale market data",
    evidence: { lastAnalysisAt, ageMin },
    impactedModules: ["Cockpit", "Worker", "Command Center"],
    recommendedAction:
      "Run a fresh analyze cycle and verify market data fetchers before executing new orders.",
    fingerprintKey: String(Math.floor(ageMin / 10)),
  });
}

function detectPnlMismatch(
  findings: AnomalyFinding[],
  snapshot: TestnetMonitorSnapshot | null,
) {
  if (!snapshot) return;
  const tradeDiffs = snapshot.closedTrades
    .map((trade) => {
      const expected = Number((trade.grossPnl - trade.fee).toFixed(6));
      const diff = Number((trade.netPnl - expected).toFixed(6));
      if (Math.abs(diff) <= 0.01) return null;
      return { tradeId: trade.id, netPnl: trade.netPnl, expectedNet: expected, diff };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const summaryNet = snapshot.closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const summaryDiff = Number((snapshot.summary.totalRealizedPnl - summaryNet).toFixed(6));
  if (tradeDiffs.length === 0 && Math.abs(summaryDiff) <= 0.01) return;
  add(findings, {
    anomalyType: "pnl_calculation_mismatch",
    severity: tradeDiffs.length >= 3 ? "CRITICAL" : "WARNING",
    title: "PnL calculation mismatch",
    evidence: {
      tradeDiffs: tradeDiffs.slice(0, 10),
      summaryTotalRealizedPnl: snapshot.summary.totalRealizedPnl,
      summaryClosedTradesNet: summaryNet,
      summaryDiff,
    },
    impactedModules: ["Testnet Monitor", "Learning", "Risk Replay", "Ledger"],
    recommendedAction:
      "Audit PnL formulas and reconcile gross/fee/net fields before trusting evaluation metrics.",
    fingerprintKey:
      `${tradeDiffs.length}:${summaryDiff.toFixed(2)}:${tradeDiffs.slice(0, 3).map((item) => item.tradeId).join(",")}`,
  });
}

function detectAlertDeliveryFailure(
  findings: AnomalyFinding[],
  failureCount: number,
  anyChannelConfigured: boolean,
) {
  if (failureCount <= 0) return;
  const testnetPrimary = isTestnetPrimaryAutomation();
  const severity =
    testnetPrimary && !anyChannelConfigured
      ? "WARNING"
      : failureCount >= 3 || !anyChannelConfigured
        ? "CRITICAL"
        : "WARNING";
  add(findings, {
    anomalyType: "alert_delivery_failed",
    severity,
    title: "Alert delivery failed",
    evidence: { failureCount, anyChannelConfigured },
    impactedModules: ["Notifications", "Worker", "Command Center"],
    recommendedAction:
      "Restore at least one alert channel and retry delivery to ensure operator visibility.",
    fingerprintKey: `${failureCount}:${anyChannelConfigured ? "cfg" : "nocfg"}`,
  });
}

function detectAutomationJobFailure(
  findings: AnomalyFinding[],
  failedJobs: Array<{ failedJobId: string; jobType: string; retryCount: number; error: string }>,
) {
  if (failedJobs.length === 0) return;
  const severe = failedJobs.some((job) => job.retryCount >= 3);
  add(findings, {
    anomalyType: "automation_job_failed",
    severity: severe ? "CRITICAL" : "WARNING",
    title: "Automation job failed",
    evidence: {
      count: failedJobs.length,
      jobs: failedJobs.slice(0, 8).map((job) => ({
        failedJobId: job.failedJobId,
        jobType: job.jobType,
        retryCount: job.retryCount,
        error: job.error,
      })),
    },
    impactedModules: ["Worker", "Command Center", "Cockpit"],
    recommendedAction:
      "Inspect failed automation jobs, fix root causes, and retry only after blockers are cleared.",
    fingerprintKey: failedJobs
      .slice(0, 5)
      .map((job) => `${job.jobType}:${job.retryCount}`)
      .join(","),
  });
}

function detectTestnetLiveFlagMismatch(
  findings: AnomalyFinding[],
  input: {
    testnetEnabled: boolean;
    liveEnabled: boolean;
    autoExecuteEnabled: boolean;
  },
) {
  const mismatch =
    input.liveEnabled ||
    (input.autoExecuteEnabled && !input.testnetEnabled) ||
    (input.liveEnabled && input.testnetEnabled);
  if (!mismatch) return;
  add(findings, {
    anomalyType: "testnet_live_flag_mismatch",
    severity: input.liveEnabled ? "CRITICAL" : "WARNING",
    title: "Testnet/live flag mismatch",
    evidence: input,
    impactedModules: ["Testnet Monitor", "Worker", "Command Center"],
    recommendedAction:
      "Keep live disabled for this workflow and align BINANCE_* flags to testnet-only execution.",
    fingerprintKey: `${input.testnetEnabled}:${input.liveEnabled}:${input.autoExecuteEnabled}`,
  });
}

function detectUnexpectedOpenPosition(
  findings: AnomalyFinding[],
  snapshot: TestnetMonitorSnapshot | null,
  journal: BinanceTestnetJournalEntry[],
  allowedSymbols: string[],
) {
  if (!snapshot || snapshot.openPositions.length === 0) return;
  const journalOpenSymbols = new Set(
    journal
      .filter((item) => ["SUBMITTED", "FILLED", "CLOSING"].includes(item.status))
      .map((item) => item.symbol),
  );
  const allowed = new Set(allowedSymbols.map((symbol) => symbol.toUpperCase()));
  const unexpected = snapshot.openPositions
    .filter(
      (pos) =>
        !journalOpenSymbols.has(pos.symbol) ||
        (allowed.size > 0 && !allowed.has(pos.symbol.toUpperCase())),
    )
    .map((pos) => ({
      symbol: pos.symbol,
      qty: pos.qty,
      decisionLogId: pos.decisionLogId,
      source: pos.source,
    }));
  if (unexpected.length === 0) return;
  add(findings, {
    anomalyType: "unexpected_open_position",
    severity: "WARNING",
    title: "Unexpected open position",
    evidence: { unexpected },
    impactedModules: ["Testnet Monitor", "Ledger", "Command Center"],
    recommendedAction:
      "Investigate manual/external positions and reconcile source-of-truth before new entries.",
    fingerprintKey: unexpected.map((item) => item.symbol).join(","),
  });
}

function detectCloseReduceOnlyFailed(
  findings: AnomalyFinding[],
  journal: BinanceTestnetJournalEntry[],
  monitorErrors: Array<{ eventType: string; symbol: string | null; payload: Record<string, unknown> }>,
) {
  const reduceOnlyFailures = journal.filter((item) => {
    if (item.status !== "FAILED" && item.status !== "CLOSING") return false;
    const text = `${item.reason} ${item.operatorNote ?? ""} ${item.blockReasons.join(" ")}`.toLowerCase();
    if (item.status === "CLOSING") {
      const age = minutesSince(item.executedAt ?? item.createdAt);
      return age != null && age >= 20;
    }
    return text.includes("reduce") || text.includes("close");
  });

  const monitorCloseErrors = monitorErrors.filter((item) => {
    if (item.eventType !== "ERROR") return false;
    const text = JSON.stringify(item.payload).toLowerCase();
    return text.includes("close") || text.includes("reduce");
  });

  if (reduceOnlyFailures.length === 0 && monitorCloseErrors.length === 0) return;
  add(findings, {
    anomalyType: "close_reduce_only_failed",
    severity:
      reduceOnlyFailures.length + monitorCloseErrors.length >= 2
        ? "CRITICAL"
        : "WARNING",
    title: "Close reduce-only failed",
    evidence: {
      journalFailures: reduceOnlyFailures.slice(0, 8).map((item) => ({
        tradeId: item.binanceTestnetTradeId,
        symbol: item.symbol,
        status: item.status,
        reason: item.reason,
        blockReasons: item.blockReasons,
      })),
      monitorCloseErrors: monitorCloseErrors.slice(0, 8),
    },
    impactedModules: ["Testnet Monitor", "Worker", "Notifications"],
    recommendedAction:
      "Manually verify reduce-only close state and retry close with explicit operator confirmation.",
    fingerprintKey: `${reduceOnlyFailures.length}:${monitorCloseErrors.length}`,
  });
}

function detectExecutionQualityDegraded(
  findings: AnomalyFinding[],
  input: {
    gateStatus: "PASS" | "WARNING" | "FAIL";
    reasons: string[];
    rejectionRatePct: number;
    failedCloseRatePct: number;
    avgSlippageBps: number;
  },
) {
  if (input.gateStatus === "PASS") return;
  add(findings, {
    anomalyType: "execution_quality_degraded",
    severity: input.gateStatus === "FAIL" ? "CRITICAL" : "WARNING",
    title: "Execution quality degraded",
    evidence: {
      gateStatus: input.gateStatus,
      reasons: input.reasons,
      rejectionRatePct: input.rejectionRatePct,
      failedCloseRatePct: input.failedCloseRatePct,
      avgSlippageBps: input.avgSlippageBps,
    },
    impactedModules: ["Execution Quality", "Live Evidence", "Testnet Monitor"],
    recommendedAction:
      "Reduce execution risk and clear quality blockers before any live readiness promotion.",
    fingerprintKey: `${input.gateStatus}:${input.reasons.join("|")}`,
  });
}

export async function runAnomalyDetectionSnapshot(options?: {
  persist?: boolean;
  useCache?: boolean;
}): Promise<AnomalyDetectionSummary> {
  const useCache = options?.useCache !== false;
  if (useCache && cachedSummary && Date.now() - cachedAt < CACHE_MS) {
    return cachedSummary;
  }

  const [
    observability,
    monitorSnapshot,
    journal,
    failedJobs,
    backbone,
    portfolio,
    monitorEvents,
  ] = await Promise.all([
    buildObservabilitySnapshot("server-default", {
      promoteIncidents: false,
      useCache: false,
    }),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerBinanceTestnetJournal().catch(() => []),
    loadFailedAutomationJobs().catch(() => []),
    loadServerBackboneRecord().catch(() => null),
    loadServerUnifiedPortfolio().catch(() => null),
    loadMonitorJournalEvents().catch(() => []),
  ]);

  const findings: AnomalyFinding[] = [];

  detectExchangeDisconnected(
    findings,
    observability.signals.exchange.connected,
    observability.signals.exchange.configured,
    observability.signals.exchange.error,
  );
  detectExecutedWithoutLedger(
    findings,
    journal,
    (backbone?.trades ?? []).map((trade) => ({
      tradeId: trade.tradeId,
      decisionId: trade.decisionId,
      instrument: trade.instrument,
      openedAt: trade.openedAt,
    })),
  );
  detectLedgerWithoutExchange(
    findings,
    [
      ...(monitorSnapshot?.openPositions.map((pos) => pos.symbol) ?? []),
      ...journal
        .filter((item) => ["SUBMITTED", "FILLED", "CLOSING"].includes(item.status))
        .map((item) => item.symbol),
    ],
    [
      ...(backbone?.trades
        .filter((trade) => trade.book === "TESTNET" && trade.status === "OPEN")
        .map((trade) => trade.instrument) ?? []),
      ...(portfolio?.openPositions
        .filter((pos) => pos.status === "OPEN")
        .map((pos) => pos.symbol) ?? []),
    ],
  );
  detectPositionSizeMismatch(findings, monitorSnapshot, journal);
  detectDuplicateOrder(findings, journal);
  detectStaleMarketData(findings, observability.signals.marketData.lastAnalysisAt);
  detectPnlMismatch(findings, monitorSnapshot);
  detectAlertDeliveryFailure(
    findings,
    observability.signals.alerts.recentDeliveryFailures,
    observability.signals.alerts.anyChannelConfigured,
  );
  detectAutomationJobFailure(
    findings,
    failedJobs.map((job) => ({
      failedJobId: job.failedJobId,
      jobType: job.jobType,
      retryCount: job.retryCount,
      error: job.error,
    })),
  );
  const binanceConfig = loadBinanceConfig();
  detectTestnetLiveFlagMismatch(findings, {
    testnetEnabled: binanceConfig.testnetEnabled,
    liveEnabled: binanceConfig.liveEnabled,
    autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
  });
  detectUnexpectedOpenPosition(
    findings,
    monitorSnapshot,
    journal,
    binanceConfig.allowedSymbols,
  );
  detectCloseReduceOnlyFailed(
    findings,
    journal,
    monitorEvents.map((event) => ({
      eventType: event.eventType,
      symbol: event.symbol,
      payload: event.payload,
    })),
  );
  const executionQuality = buildExecutionQualitySummary({ testnetJournal: journal });
  detectExecutionQualityDegraded(findings, {
    gateStatus: executionQuality.liveQualityGate.status,
    reasons: executionQuality.liveQualityGate.reasons,
    rejectionRatePct: executionQuality.rejectionRatePct,
    failedCloseRatePct: executionQuality.failedCloseRatePct,
    avgSlippageBps: executionQuality.averageSlippageBps,
  });

  const incidents =
    options?.persist === false
      ? await loadAnomalyIncidents()
      : await upsertAnomalyFindings(findings);

  const open = incidents.filter((item) => isIncidentOpen(item.status));
  const warningOpenCount = open.filter((item) => item.severity === "WARNING").length;
  const criticalOpen = open.filter((item) => item.severity === "CRITICAL");
  const blockingCriticalOpen = filterBlockingCriticalIncidents(criticalOpen);

  const summary: AnomalyDetectionSummary = {
    generatedAt: new Date().toISOString(),
    findings,
    incidents,
    openCount: open.length,
    warningOpenCount,
    criticalOpenCount: criticalOpen.length,
    blocksRiskyActions: blockingCriticalOpen.length > 0,
  };

  cachedSummary = summary;
  cachedAt = Date.now();
  return summary;
}

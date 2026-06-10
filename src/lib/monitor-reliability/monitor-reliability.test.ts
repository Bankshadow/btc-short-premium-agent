import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BinanceOrderPreview,
  BinancePosition,
  BinanceTestnetJournalEntry,
} from "@/lib/exchange/binance/binance-types";
import { markIssuesRecovered } from "./auto-recover-monitor";
import {
  detectExpiredExecutablePreviews,
  detectMonitorIssues,
  resolveMonitorHealth,
  resolvePrimaryMonitorIssueMessage,
} from "./detect-monitor-issues";
import { emptyMonitorReliabilitySnapshot } from "./empty-snapshot";
import { emptyMonitorHeartbeat } from "./heartbeat-store";
import { MONITOR_STALE_MS } from "./types";

function journalEntry(
  partial: Partial<BinanceTestnetJournalEntry> & Pick<BinanceTestnetJournalEntry, "symbol">,
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: partial.binanceTestnetTradeId ?? "bn-tn-1",
    previewId: partial.previewId ?? "prev-1",
    symbol: partial.symbol,
    side: partial.side ?? "BUY",
    notionalUsd: 100,
    quantity: "0.01",
    status: partial.status ?? "FILLED",
    source: "ai_signal",
    reason: "test",
    decisionLogId: partial.decisionLogId ?? "dl-1",
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: partial.operatorNote ?? null,
    blockReasons: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:00:00.000Z",
    closedAt: partial.closedAt ?? null,
    realizedPnl: partial.realizedPnl ?? null,
    fees: null,
    previewPrice: 100,
    markPriceAtSubmit: 101,
    fillPrice: 100,
    slippage: null,
    slippageBps: null,
    latencyMs: null,
    partialFill: false,
    duplicateSubmission: false,
    retryCount: 0,
    closeAttempt: partial.closeAttempt ?? false,
    closeFailed: partial.closeFailed ?? false,
    ...partial,
  };
}

function position(
  partial: Partial<BinancePosition> & Pick<BinancePosition, "symbol">,
): BinancePosition {
  return {
    symbol: partial.symbol,
    positionAmt: partial.positionAmt ?? "0.01",
    entryPrice: partial.entryPrice ?? "100",
    markPrice: partial.markPrice ?? "101",
    unRealizedProfit: partial.unRealizedProfit ?? "1",
    leverage: partial.leverage ?? "1",
    marginType: partial.marginType ?? "cross",
    isolatedMargin: partial.isolatedMargin ?? "0",
    isAutoAddMargin: partial.isAutoAddMargin ?? "false",
    positionSide: partial.positionSide ?? "BOTH",
    notional: partial.notional ?? "100",
    isolatedWallet: partial.isolatedWallet ?? "0",
    updateTime: partial.updateTime ?? Date.now(),
  };
}

describe("Monitor reliability (MVP 73B)", () => {
  it("detects exchange closed but journal still FILLED", () => {
    const issues = detectMonitorIssues({
      journal: [journalEntry({ symbol: "BTCUSDT", status: "FILLED" })],
      positions: [],
      connected: true,
      autoExecuteEnabled: true,
      heartbeat: emptyMonitorHeartbeat(),
    });
    assert.ok(
      issues.some((i) => i.kind === "exchange_closed_not_journaled"),
      "expected exchange_closed_not_journaled",
    );
  });

  it("detects CLOSED journal missing PnL", () => {
    const issues = detectMonitorIssues({
      journal: [
        journalEntry({
          symbol: "ETHUSDT",
          status: "CLOSED",
          realizedPnl: null,
          closedAt: "2026-01-01T01:00:00.000Z",
        }),
      ],
      positions: [],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    assert.ok(issues.some((i) => i.kind === "closed_journal_missing_pnl"));
  });

  it("detects duplicate close attempts", () => {
    const issues = detectMonitorIssues({
      journal: [
        journalEntry({ symbol: "SOLUSDT", status: "CLOSING", binanceTestnetTradeId: "a" }),
        journalEntry({ symbol: "SOLUSDT", status: "CLOSING", binanceTestnetTradeId: "b", previewId: "p2" }),
      ],
      positions: [position({ symbol: "SOLUSDT" })],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    assert.ok(issues.some((i) => i.kind === "duplicate_close_attempt"));
  });

  it("detects stale monitor heartbeat with open positions", () => {
    const stale = new Date(Date.now() - MONITOR_STALE_MS - 60_000).toISOString();
    const issues = detectMonitorIssues({
      journal: [],
      positions: [position({ symbol: "BTCUSDT" })],
      connected: true,
      autoExecuteEnabled: true,
      heartbeat: { ...emptyMonitorHeartbeat(), lastMonitorRunAt: stale },
    });
    assert.ok(issues.some((i) => i.kind === "monitor_not_running"));
    assert.ok(issues.some((i) => i.kind === "position_not_monitored"));
  });

  it("detects expired preview still in cache", () => {
    const preview: BinanceOrderPreview = {
      previewId: "exp-prev",
      symbol: "BTCUSDT",
      side: "BUY",
      estimatedQty: "0.01",
      notionalUsd: 100,
      markPrice: 100,
      riskChecks: [],
      blocked: false,
      blockReasons: [],
      requiresDoubleConfirm: false,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      source: "ai_signal",
      reason: "test",
      decisionLogId: "dl-1",
      generatedAt: "2026-01-01T00:00:00.000Z",
    };
    const issues = detectExpiredExecutablePreviews({
      previewCache: { "exp-prev": preview },
      journal: [],
    });
    assert.ok(issues.some((i) => i.kind === "expired_preview_executable"));
  });

  it("detects orphan exchange position without journal", () => {
    const issues = detectMonitorIssues({
      journal: [],
      positions: [position({ symbol: "XRPUSDT" })],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    assert.ok(issues.some((i) => i.kind === "position_state_uncertain"));
  });

  it("marks position uncertain as BLOCKED health", () => {
    const issues = detectMonitorIssues({
      journal: [],
      positions: [position({ symbol: "XRPUSDT" })],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    const uncertain = issues.some((i) => i.kind === "position_state_uncertain");
    assert.equal(
      resolveMonitorHealth(issues, uncertain),
      "BLOCKED",
    );
  });

  it("marks recovered reconcile issues after auto-recovery", () => {
    const issues = detectMonitorIssues({
      journal: [journalEntry({ symbol: "BTCUSDT", status: "FILLED" })],
      positions: [],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    const recovered = markIssuesRecovered(issues, ["Reconciled journal with exchange positions"]);
    const journaled = recovered.find((i) => i.kind === "exchange_closed_not_journaled");
    assert.equal(journaled?.recovered, true);
  });

  it("blocks new entries when position state uncertain", () => {
    const issues = detectMonitorIssues({
      journal: [],
      positions: [position({ symbol: "BTCUSDT" })],
      connected: true,
      autoExecuteEnabled: false,
      heartbeat: emptyMonitorHeartbeat(),
    });
    const positionStateUncertain = issues.some(
      (i) =>
        !i.recovered &&
        (i.kind === "position_state_uncertain" ||
          i.kind === "exchange_closed_not_journaled" ||
          i.kind === "duplicate_close_attempt"),
    );
    assert.equal(positionStateUncertain, true);
    const snapshot = {
      ...emptyMonitorReliabilitySnapshot(),
      blocksNewEntries: positionStateUncertain,
      positionStateUncertain,
      health: resolveMonitorHealth(issues, positionStateUncertain),
    };
    assert.equal(snapshot.blocksNewEntries, true);
    assert.equal(snapshot.health, "BLOCKED");
  });

  it("prioritizes position reconcile issue over stale heartbeat in primary message", () => {
    const staleAt = new Date(Date.now() - MONITOR_STALE_MS - 60_000).toISOString();
    const issues = detectMonitorIssues({
      journal: [],
      positions: [position({ symbol: "DOGEUSDT", positionAmt: "-647" })],
      connected: true,
      autoExecuteEnabled: true,
      heartbeat: {
        ...emptyMonitorHeartbeat(),
        lastMonitorRunAt: staleAt,
        lastRunId: "old-run",
      },
    });
    const message = resolvePrimaryMonitorIssueMessage(issues);
    assert.ok(message?.includes("DOGEUSDT"));
    assert.ok(message?.includes("no matching journal"));
  });

  it("treats heartbeat as fresh within the same automation run", () => {
    const staleAt = new Date(Date.now() - MONITOR_STALE_MS - 60_000).toISOString();
    const runId = "acp-same-cycle";
    const issues = detectMonitorIssues({
      journal: [journalEntry({ symbol: "BTCUSDT", status: "FILLED" })],
      positions: [position({ symbol: "BTCUSDT" })],
      connected: true,
      autoExecuteEnabled: true,
      heartbeat: {
        ...emptyMonitorHeartbeat(),
        lastMonitorRunAt: staleAt,
        lastRunId: runId,
      },
      currentRunId: runId,
    });
    assert.equal(
      issues.some((i) => i.kind === "monitor_not_running"),
      false,
    );
  });
});

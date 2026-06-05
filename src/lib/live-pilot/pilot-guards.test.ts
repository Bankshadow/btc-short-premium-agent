import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { OrderPreviewResult } from "@/lib/exchange/types";
import type { LiveTradeJournalEntry } from "./types";
import { checkPilotGuards } from "./pilot-guards";
import { loadLivePilotRiskConfig } from "./pilot-config";
import { resolveLivePilotMode } from "./pilot-mode";
import {
  attachExecuteConfirmToken,
} from "@/lib/exchange/execute-confirm";
import { verifyPilotConfirmToken } from "./pilot-execution";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

const ENV_BACKUP: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in ENV_BACKUP)) ENV_BACKUP[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ENV_BACKUP)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function basePreview(overrides: Partial<OrderPreviewResult> = {}): OrderPreviewResult {
  return {
    valid: true,
    source: "perp_signal",
    category: "linear",
    symbol: "BTCUSDT",
    side: "Buy",
    rejectReasons: [],
    warnings: [],
    estNotionalUsd: 40,
    estQty: 0.001,
    estFeeUsd: 0.02,
    availableBalanceUsd: 1000,
    marginSufficient: true,
    bybitPayload: {},
    slTpPlan: { stopLoss: null, takeProfit: null },
    configured: true,
    network: "testnet",
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: "test",
    ...overrides,
  };
}

function todayJournalEntry(
  patch: Partial<LiveTradeJournalEntry> = {},
): LiveTradeJournalEntry {
  const now = new Date().toISOString();
  return {
    liveTradeId: `live-test-${Math.random().toString(36).slice(2, 6)}`,
    sourceSignalId: null,
    decisionLogId: null,
    previewId: "p1",
    confirmTokenId: "tok",
    exchangeOrderId: "ex1",
    status: "OPEN",
    symbol: "BTCUSDT",
    side: "Buy",
    entry: {
      price: 60000,
      qty: 0.001,
      notionalUsd: 60,
      side: "Buy",
      symbol: "BTCUSDT",
      timestamp: now,
    },
    exit: null,
    realizedPnl: null,
    fees: 0.05,
    slippage: null,
    operatorApproval: true,
    operatorApprovalNote: null,
    createdAt: now,
    executedAt: now,
    closedAt: null,
    error: null,
    pilotMode: "LIVE_SMALL_PILOT",
    ...patch,
  };
}

describe("live pilot guards", () => {
  beforeEach(() => {
    setEnv("PILOT_ENABLED", "true");
    setEnv("LIVE_EXECUTION_ENABLED", "true");
    setEnv("LIVE_REQUIRE_DOUBLE_CONFIRM", "true");
    setEnv("PILOT_MAX_NOTIONAL_USD", "50");
    setEnv("LIVE_MAX_NOTIONAL_USD", "500");
    setEnv("PILOT_DAILY_TRADE_LIMIT", "2");
    setEnv("PILOT_DAILY_LOSS_LIMIT_USD", "25");
    setEnv("PILOT_WEEKLY_LOSS_LIMIT_USD", "75");
    setEnv("PILOT_COOLDOWN_MINUTES_AFTER_LOSS", "60");
    setEnv("CRON_SECRET", "test-cron-secret-for-pilot");
  });

  afterEach(() => {
    restoreEnv();
  });

  it("blocks when pilot disabled", () => {
    setEnv("PILOT_ENABLED", "false");
    setEnv("LIVE_EXECUTION_ENABLED", "false");
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const result = checkPilotGuards({
      preview: basePreview(),
      journal: [],
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("PILOT_ENABLED")));
  });

  it("blocks over max notional", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const result = checkPilotGuards({
      preview: basePreview({ estNotionalUsd: 120 }),
      journal: [],
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("pilot cap")));
  });

  it("blocks over daily trade limit", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const journal = [
      todayJournalEntry({ liveTradeId: "a" }),
      todayJournalEntry({ liveTradeId: "b" }),
    ];
    const result = checkPilotGuards({
      preview: basePreview(),
      journal,
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("Daily trade limit")));
  });

  it("blocks after daily loss limit", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const journal = [
      todayJournalEntry({
        status: "CLOSED",
        closedAt: new Date().toISOString(),
        realizedPnl: -30,
      }),
    ];
    const result = checkPilotGuards({
      preview: basePreview(),
      journal,
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("Daily loss limit")));
  });

  it("blocks when kill switch active", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const entries: DecisionLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
      id: `e-${i}`,
      timestamp: new Date().toISOString(),
      outcomeStatus: "RESOLVED",
      paperPnl: -2,
      deskRiskProfile: "balanced",
    })) as DecisionLogEntry[];

    const result = checkPilotGuards({
      preview: basePreview(),
      journal: [],
      config,
      mode,
      entries,
      orders: [],
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("Kill switch")));
  });

  it("blocks without operator approval and doubleConfirm", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const noApproval = checkPilotGuards({
      preview: basePreview(),
      journal: [],
      config,
      mode,
      operatorApproval: false,
      doubleConfirm: true,
    });
    assert.ok(noApproval.blockers.some((b) => b.includes("approval")));

    const noDouble = checkPilotGuards({
      preview: basePreview(),
      journal: [],
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: false,
    });
    assert.ok(noDouble.blockers.some((b) => b.includes("doubleConfirm")));
  });

  it("blocks BTC options live", () => {
    const config = loadLivePilotRiskConfig();
    const mode = resolveLivePilotMode(config);
    const result = checkPilotGuards({
      preview: basePreview({ category: "option", symbol: "BTC-29MAR26-65000-C" }),
      journal: [],
      config,
      mode,
      operatorApproval: true,
      doubleConfirm: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("options live")));
  });

  it("accepts valid confirm token with doubleConfirm", () => {
    const preview = attachExecuteConfirmToken(basePreview());
    assert.ok(preview.executeConfirmToken);
    assert.ok(preview.executeConfirmExpiresAt);
    const ok = verifyPilotConfirmToken({
      preview,
      token: preview.executeConfirmToken!,
      expiresAt: preview.executeConfirmExpiresAt!,
    });
    assert.equal(ok, true);

    const bad = verifyPilotConfirmToken({
      preview,
      token: "invalid-token",
      expiresAt: preview.executeConfirmExpiresAt!,
    });
    assert.equal(bad, false);
  });
});

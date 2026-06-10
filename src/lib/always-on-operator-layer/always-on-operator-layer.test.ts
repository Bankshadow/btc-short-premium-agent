import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOperatorAlerts,
  detectMissingJournalIssues,
  detectStuckPositions,
  fingerprintAlerts,
} from "./detect-operator-issues";
import { emptyAlwaysOnOperatorLayer } from "./empty-snapshot";
import type { BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { ALWAYS_ON_OPERATOR_LAYER_MVP, OPERATOR_LAYER_SAFETY_NOTICE } from "./types";

describe("always-on operator layer mvp93", () => {
  it("empty snapshot enforces safety guarantees", () => {
    const snap = emptyAlwaysOnOperatorLayer();
    assert.equal(snap.mvp, ALWAYS_ON_OPERATOR_LAYER_MVP);
    assert.equal(snap.cannotOpenOrders, true);
    assert.equal(snap.telegramCannotEnableLive, true);
    assert.equal(snap.testnetExecuteRequiresApproval, true);
    assert.equal(snap.safetyNotice, OPERATOR_LAYER_SAFETY_NOTICE);
  });

  it("detects stuck positions beyond max hold", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const journal = [
      {
        binanceTestnetTradeId: "t1",
        symbol: "BTCUSDT",
        status: "FILLED",
        createdAt: old,
      },
    ] as BinanceTestnetJournalEntry[];
    const positions = [
      { symbol: "BTCUSDT", positionAmt: "0.01" },
    ] as BinancePosition[];

    const alerts = detectStuckPositions({ journal, positions });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, "stuck_position");
  });

  it("builds alerts and fingerprints for telegram dedupe", () => {
    const alerts = buildOperatorAlerts({
      monitorIssues: [],
      stuckAlerts: [],
      missingJournalAlerts: [
        {
          alertId: "a1",
          kind: "missing_journal",
          severity: "CRITICAL",
          title: "Missing journal",
          message: "Exchange position without journal",
          symbol: "ETHUSDT",
        },
      ],
      missionMode: "PAUSED",
      permissionPending: true,
      heartbeat: {
        lastMonitorRunAt: null,
        lastPositionRefreshAt: null,
        lastCloseCheckAt: null,
        lastJournalWriteAt: null,
        lastRecoveryAt: null,
        lastRunId: null,
        updatedAt: new Date().toISOString(),
      },
      openPositionCount: 1,
      autoExecuteEnabled: true,
      connected: true,
    });

    assert.ok(alerts.some((a) => a.kind === "missing_journal"));
    assert.ok(alerts.some((a) => a.kind === "mission_paused"));
    assert.ok(alerts.some((a) => a.kind === "permission_pending"));
    assert.ok(fingerprintAlerts(alerts).length > 0);
  });

  it("detects closed trades missing decisionLogId", () => {
    const alerts = detectMissingJournalIssues({
      journal: [
        {
          binanceTestnetTradeId: "c1",
          symbol: "BTCUSDT",
          status: "CLOSED",
          decisionLogId: null,
        },
      ] as BinanceTestnetJournalEntry[],
      positions: [],
    });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, "missing_journal");
  });
});

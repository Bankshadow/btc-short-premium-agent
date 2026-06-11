import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getDefaultMissionProjection, getDefaultProjectionBundle } from "./projection-defaults";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { DEFAULT_START_CAPITAL } from "@/lib/mission/mission-types";

const UI_COMPONENTS = [
  "status-badge.tsx",
  "metric-card.tsx",
  "progress-card.tsx",
  "safety-panel.tsx",
  "lifecycle-timeline.tsx",
  "projection-warning.tsx",
  "zero-state-card.tsx",
  "risk-banner.tsx",
  "event-feed.tsx",
];

describe("UI v0 dashboard migration", () => {
  it("design system components exist", () => {
    const uiDir = path.join(process.cwd(), "src", "components", "ui");
    for (const file of UI_COMPONENTS) {
      assert.ok(fs.existsSync(path.join(uiDir, file)), `missing ${file}`);
    }
  });

  it("dashboard renders projection zero-state values", () => {
    const m = getDefaultMissionProjection();
    assert.equal(m.currentEquity, DEFAULT_START_CAPITAL);
    assert.equal(m.progressPct, 0);
    const bundle = getDefaultProjectionBundle();
    assert.equal(bundle.trades.openCount, 0);
    assert.equal(bundle.pnl.netPnl, 0);
    assert.equal(bundle.evidence.valid, 0);
    assert.equal(bundle.evidence.required, 12);
    assert.equal(bundle.risk.liveLocked, true);
  });

  it("dashboard page does not calculate PnL locally", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "dashboard-client.tsx"), "utf8");
    const forbidden = ["calculatePnlForTrade", "buildPnlProjection", "sumNetPnl"];
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `dashboard must not use ${token}`);
    }
    assert.ok(src.includes("useUiProjectionData") || src.includes("coalesceUiProjection"));
  });

  it("reports page does not calculate evidence locally", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "reports", "reports-client.tsx"), "utf8");
    const forbidden = ["buildEvidenceProgress", "validateTradeEvidence", "EVIDENCE_TARGET"];
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `reports must not use ${token}`);
    }
    assert.ok(src.includes("useUiProjectionData") || src.includes("coalesceUiProjection"));
  });

  it("trades page uses shared projection bundle", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "trades-client.tsx"), "utf8");
    assert.ok(src.includes("useUiProjectionData") || src.includes("coalesceUiProjection"));
    assert.ok(!src.includes("buildOpenTradesFromEvents"));
  });

  it("settings page does not expose secrets", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "settings", "page.tsx"), "utf8");
    assert.ok(!src.includes("BINANCE_API_SECRET"));
    assert.ok(!src.includes("process.env.BINANCE"));
    assert.ok(src.includes("apiKeyPresent"));
    assert.ok(src.includes("apiSecretPresent"));
  });

  it("core page shows health and consistency status", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "core", "core-client.tsx"), "utf8");
    assert.ok(src.includes("UI consistency"));
    assert.ok(src.includes("Projection parity"));
    assert.ok(src.includes("warningCount") || src.includes("rawWarningCount"));
    assert.ok(!src.includes("LoadingOrError"));
  });

  it("pages do not use permanent LoadingOrError gate", () => {
    const pages = ["dashboard-client.tsx", "trades/trades-client.tsx", "ai-status/page.tsx", "reports/reports-client.tsx", "settings/page.tsx", "core/core-client.tsx"];
    for (const rel of pages) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", rel), "utf8");
      assert.ok(!src.includes("LoadingOrError"), `${rel} must not block on LoadingOrError`);
    }
  });

  it("dashboard does not import v0 mock data", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "dashboard-client.tsx"), "utf8");
    assert.ok(!src.includes("mock.json"));
    assert.ok(!src.includes("mockData"));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("safety labels are defined", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "components", "ui", "safety-labels.tsx"), "utf8");
    assert.ok(src.includes("TESTNET ONLY"));
    assert.ok(src.includes("NO AUTO-EXECUTE"));
    assert.ok(src.includes("REDUCE-ONLY CLOSE REQUIRED"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zeroProjectionBundle, buildProjectionBundle } from "./projection-bundle";
import { runUiConsistencyCheck } from "./ui-consistency-check";
import { DEFAULT_START_CAPITAL, DEFAULT_TARGET_CAPITAL } from "@/lib/mission/mission-types";

describe("Slice 7 — projection UI", () => {
  it("zero projection bundle matches safe zero-state defaults", () => {
    const z = zeroProjectionBundle();
    assert.equal(z.mission.currentEquity, DEFAULT_START_CAPITAL);
    assert.equal(z.mission.targetCapital, DEFAULT_TARGET_CAPITAL);
    assert.equal(z.mission.progressPct, 0);
    assert.equal(z.trades.open.length, 0);
    assert.equal(z.trades.closed.length, 0);
    assert.equal(z.pnl.totalNetPnl, 0);
    assert.equal(z.evidence.valid, 0);
    assert.equal(z.evidence.required, 12);
    assert.equal(z.risk.liveLocked, true);
    assert.equal(z.health.status, "OK");
  });

  it("buildProjectionBundle returns ok payload on empty journal", async () => {
    const prev = process.env.JOURNAL_DATA_DIR;
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slice7-ui-"));
    process.env.JOURNAL_DATA_DIR = tmp;
    try {
      const bundle = await buildProjectionBundle();
      assert.equal(bundle.ok, true);
      if (bundle.ok) {
        assert.equal(bundle.mission.currentEquity, DEFAULT_START_CAPITAL);
        assert.equal(bundle.trades.open.length, 0);
        assert.equal(bundle.pnl.totalNetPnl, 0);
        assert.equal(bundle.evidence.valid, 0);
      }
    } finally {
      if (prev !== undefined) process.env.JOURNAL_DATA_DIR = prev;
      else delete process.env.JOURNAL_DATA_DIR;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ui consistency check passes on empty journal", async () => {
    const prev = process.env.JOURNAL_DATA_DIR;
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slice7-consistency-"));
    process.env.JOURNAL_DATA_DIR = tmp;
    try {
      const report = await runUiConsistencyCheck();
      assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
      assert.ok(report.checks.length >= 5);
      assert.equal(report.mismatches.length, 0);
    } finally {
      if (prev !== undefined) process.env.JOURNAL_DATA_DIR = prev;
      else delete process.env.JOURNAL_DATA_DIR;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("dashboard and reports equity use same mission projection source", () => {
    const z = zeroProjectionBundle();
    const dashboardEquity = z.mission.currentEquity;
    const reportsEquity = z.mission.currentEquity;
    assert.equal(dashboardEquity, reportsEquity);
  });

  it("trade counts align across bundle and enriched summary shape", () => {
    const z = zeroProjectionBundle();
    assert.equal(z.trades.open.length, z.positions.openTradeCount);
    assert.equal(z.trades.closed.length, 0);
  });

  it("evidence progress matches across pages from single bundle", () => {
    const z = zeroProjectionBundle();
    assert.equal(z.evidence.valid, 0);
    assert.equal(z.evidence.required, 12);
  });

  it("core pages do not import local mission snapshot builders", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.join(process.cwd(), "src", "app");
    const pages = [
      "page.tsx",
      "trades/page.tsx",
      "ai-status/page.tsx",
      "reports/page.tsx",
      "settings/page.tsx",
      "operator/page.tsx",
    ];
    const forbidden = [
      "buildMissionSnapshot",
      "buildEvidenceProgress",
      "calculatePnlForTrade",
      "/api/mission/snapshot",
    ];
    for (const rel of pages) {
      const file = path.join(root, rel);
      const src = fs.readFileSync(file, "utf8");
      for (const token of forbidden) {
        assert.ok(!src.includes(token), `${rel} must not use ${token}`);
      }
    }
  });

  it("core pages do not render secret env keys", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.join(process.cwd(), "src", "app");
    const pages = [
      "page.tsx",
      "trades/page.tsx",
      "ai-status/page.tsx",
      "reports/page.tsx",
      "settings/page.tsx",
      "operator/page.tsx",
    ];
    const forbidden = ["BINANCE_API_SECRET", "process.env.BINANCE", "API_SECRET"];
    for (const rel of pages) {
      const file = path.join(root, rel);
      const src = fs.readFileSync(file, "utf8");
      for (const token of forbidden) {
        assert.ok(!src.includes(token), `${rel} must not expose ${token}`);
      }
    }
  });
});

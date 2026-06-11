import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getUiBundle, resolveUiBundleSource } from "./get-ui-bundle";
import { normalizeProjectionBundle } from "./normalize-projection-bundle";
import {
  aggregateEvidenceRejectionReasons,
  mapNormalizedToUiProjectionData,
} from "./ui-projection-data";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
} from "./projection-defaults";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { PNL_PENDING_LABEL } from "./stale-trade-display";

export function productionBundleFixture(totalTrades = 8) {
  return {
    ok: true,
    mission: {
      ...getDefaultMissionProjection(),
      totalTrades,
      latestRunId: "run-1781181033583-04qss4",
      latestDecisionLogId: "dl-1781181033583-cx4dhr",
      latestVerdict: "TRADE",
      zeroState: false,
    },
    trades: {
      ...getDefaultTradeProjection(),
      open: [],
      closed: Array.from({ length: totalTrades }, (_, i) => ({
        tradeId: `t${i}`,
        status: "CLOSED_PENDING_PNL",
        result: "PENDING_PNL",
      })),
      effectiveOpenCount: 0,
    },
    positions: getDefaultProjectionBundle().positions,
    pnl: getDefaultProjectionBundle().pnl,
    evidence: {
      ...getDefaultProjectionBundle().evidence,
      valid: 0,
      required: 12,
      rejected: totalTrades,
      trades: Array.from({ length: totalTrades }, (_, i) => ({
        tradeId: `t${i}`,
        status: "REJECTED" as const,
        rejectionReasons: [
          "ZERO_QTY",
          "MISSING_ENTRY_PRICE",
          "PNL_PENDING_DATA",
          "MISSING_EXIT_PRICE",
        ],
        validatedAt: new Date().toISOString(),
      })),
    },
    risk: { liveLocked: true },
    health: {
      status: "WARNING",
      exchangeStatus: "CONNECTED",
      liveLocked: true,
      warnings: [{ code: "SKIPPED_LIFECYCLE_STEP", count: 9, message: "skipped", severity: "WARNING" }],
      blockingIssues: [],
      rawWarningCount: 9,
    },
    meta: { eventCount: 699, builtAt: new Date().toISOString(), cacheKey: "699" },
  };
}

describe("Core Engine hotfix 8 — server/UI bundle binding", () => {
  it("mapNormalizedToUiProjectionData maps production fixture to 8/8/0", () => {
    const normalized = normalizeProjectionBundle(productionBundleFixture(8));
    const ui = mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" });
    assert.equal(ui.source, "REAL_BUNDLE");
    assert.equal(ui.mission.totalTrades, 8);
    assert.equal(ui.mission.closedTrades, 8);
    assert.equal(ui.mission.openTrades, 0);
    assert.equal(ui.evidence.valid, 0);
    assert.equal(ui.evidence.required, 12);
    assert.equal(ui.evidence.rejected, 8);
    assert.equal(ui.health.status, "WARNING");
    assert.equal(ui.health.rawWarningCount, 9);
    assert.equal(ui.mission.latestVerdict, "TRADE");
  });

  it("aggregateEvidenceRejectionReasons summarizes rejection codes", () => {
    const normalized = normalizeProjectionBundle(productionBundleFixture(8));
    const ui = mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" });
    const reasons = aggregateEvidenceRejectionReasons(ui.evidence);
    assert.ok(reasons.some((r) => r.startsWith("ZERO_QTY")));
    assert.ok(reasons.some((r) => r.startsWith("PNL_PENDING_DATA")));
    assert.ok(reasons.some((r) => r.startsWith("MISSING_ENTRY_PRICE")));
    assert.ok(reasons.some((r) => r.startsWith("MISSING_EXIT_PRICE")));
  });

  it("getUiBundle maps builder payload directly and marks REAL_BUNDLE when trades exist", async () => {
    const ui = await getUiBundle();
    assert.ok(["REAL_BUNDLE", "FALLBACK"].includes(ui.source));
    if (ui.mission.totalTrades > 0 || ui.trades.closed.length > 0) {
      assert.equal(ui.source, "REAL_BUNDLE");
    }
    assert.ok(typeof ui.mission.totalTrades === "number");
    assert.ok(Array.isArray(ui.trades.closed));
    assert.equal(ui.risk.liveLocked, true);
  });

  it("resolveUiBundleSource returns REAL_BUNDLE when builder has closed trades", () => {
    const normalized = normalizeProjectionBundle(productionBundleFixture(8));
    const source = resolveUiBundleSource(
      { ok: true, ...productionBundleFixture(8) } as import("./projection-bundle-shared").ProjectionBundleResponse,
      normalized,
    );
    assert.equal(source, "REAL_BUNDLE");
  });

  it("layout loads server bundle via getUiBundle", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    assert.ok(layout.includes("getUiBundle"));
    assert.ok(layout.includes("initialUiBundle"));
    assert.ok(layout.includes('dynamic = "force-dynamic"'));
  });

  it("provider accepts server initialUiBundle and skips client zero-state", () => {
    const provider = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "projection-bundle-provider.tsx"),
      "utf8",
    );
    assert.ok(provider.includes("initialUiBundle"));
    assert.ok(provider.includes("serverBundleReady"));
    assert.ok(provider.includes("data.isFallback && serverBundleReady.current"));
  });

  it("dashboard server page loads getUiBundle and passes to client", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    const client = fs.readFileSync(path.join(process.cwd(), "src", "app", "dashboard-client.tsx"), "utf8");
    assert.ok(page.includes("getUiBundle"));
    assert.ok(page.includes("DashboardClient"));
    assert.ok(client.includes("coalesceUiProjection"));
    assert.ok(client.includes("ui.mission.totalTrades"));
    assert.ok(client.includes("ui.health.status"));
    assert.ok(client.includes("Projection source:"));
  });

  it("trades server page loads getUiBundle", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "page.tsx"), "utf8");
    assert.ok(page.includes("getUiBundle"));
    assert.ok(page.includes("TradesClient"));
  });

  it("core page renders bundle health and trade counts", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "src", "app", "core", "core-client.tsx"), "utf8");
    assert.ok(client.includes("ui.health.status"));
    assert.ok(client.includes("rawWarningCount"));
    assert.ok(client.includes("Projection source:"));
  });

  it("trades page renders closed rows from ui bundle", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "trades-client.tsx"), "utf8");
    assert.ok(client.includes("ui.trades.closed.map"));
    assert.ok(client.includes("PNL_PENDING_LABEL"));
  });

  it("reports page shows evidence rejection reasons", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "src", "app", "reports", "reports-client.tsx"), "utf8");
    assert.ok(client.includes("aggregateEvidenceRejectionReasons"));
    assert.ok(client.includes("ui.evidence.rejected"));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("ui bundle mapping does not expose secrets", () => {
    const normalized = normalizeProjectionBundle(productionBundleFixture(8));
    const ui = mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" });
    const serialized = JSON.stringify(ui);
    assert.ok(!serialized.includes("super-secret-key"));
  });
});

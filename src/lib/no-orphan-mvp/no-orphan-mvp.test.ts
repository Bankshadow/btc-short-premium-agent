import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NO_ORPHAN_MVP_CHECKLIST,
  MVP_INTEGRATION_REGISTRY,
  assertNoOrphanMvps,
  validateNewMvpContract,
} from "./index";
import {
  assertClosedTradePropagation,
  verifyEmptyStateNotOrphanUi,
} from "./propagation/closed-trade-propagation";
import { assertStrategyHealthPropagation } from "./propagation/strategy-health-propagation";
import { assertReadinessPropagation } from "./propagation/readiness-propagation";
import type { MvpIntegrationContract } from "./types";

describe("No Orphan MVP Rule", () => {
  it("defines a development checklist with required integration points", () => {
    assert.ok(NO_ORPHAN_MVP_CHECKLIST.length >= 9);
    assert.ok(NO_ORPHAN_MVP_CHECKLIST.some((line) => line.includes("Journal event")));
    assert.ok(NO_ORPHAN_MVP_CHECKLIST.some((line) => line.includes("Dashboard")));
  });

  it("all registered MVPs pass wiring validation", () => {
    const report = assertNoOrphanMvps(process.cwd());
    assert.equal(report.allPassed, true);
    assert.equal(report.orphanMvps.length, 0);
    assert.ok(report.results.length >= 6);
  });

  it("rejects UI-only orphan MVP contracts", () => {
    const orphanUiOnly: MvpIntegrationContract = {
      mvpId: 999,
      name: "Orphan UI Panel",
      tradeAffecting: false,
      checks: [
        {
          kind: "dashboard_visibility",
          label: "Dashboard panel",
          paths: ["src/components/goal/GoalDashboard.tsx"],
          mustContain: "OrphanUiOnlyPanel",
          required: true,
        },
        {
          kind: "reports_visibility",
          label: "Reports panel",
          paths: ["src/components/goal/ReportsView.tsx"],
          mustContain: "OrphanUiOnlyPanel",
          required: true,
        },
      ],
    };
    const result = validateNewMvpContract(orphanUiOnly, process.cwd());
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((f) => f.includes("route_or_api") || f.includes("data_source")));
  });

  it("registry covers integrated MVPs 73–79", () => {
    const ids = MVP_INTEGRATION_REGISTRY.map((m) => m.mvpId).sort((a, b) => a - b);
    for (const id of [73, 74, 75, 76, 78, 79]) {
      assert.ok(ids.includes(id), `MVP ${id} missing from registry`);
    }
  });
});

describe("Closed trade propagation", () => {
  it("updates journal, mission snapshot, trades, reports, learning queue", () => {
    const report = assertClosedTradePropagation();
    assert.equal(report.scenario, "closed_trade_propagation");
    const ids = new Set(report.checks.filter((c) => c.passed).map((c) => c.id));
    assert.ok(ids.has("journal_closed"));
    assert.ok(ids.has("evidence_progress"));
    assert.ok(ids.has("learning_queue"));
    assert.ok(ids.has("mission_snapshot_evidence"));
    assert.ok(ids.has("reports_fields"));
  });

  it("empty state does not fabricate trade evidence", () => {
    const report = verifyEmptyStateNotOrphanUi();
    assert.equal(report.passed, true);
  });
});

describe("Strategy health propagation", () => {
  it("updates reports, AI status, journal wiring, registry recommendation", async () => {
    const report = await assertStrategyHealthPropagation();
    const ids = new Set(report.checks.filter((c) => c.passed).map((c) => c.id));
    assert.ok(ids.has("integrated_snapshot"));
    assert.ok(ids.has("registry_recommendation"));
    assert.ok(ids.has("ai_status_next_action"));
    assert.ok(ids.has("mission_snapshot_field"));
    assert.ok(ids.has("journal_event_wiring"));
  });
});

describe("Readiness propagation", () => {
  it("updates dashboard badge field, reports, governance warning, journal wiring", async () => {
    const report = await assertReadinessPropagation();
    const ids = new Set(report.checks.filter((c) => c.passed).map((c) => c.id));
    assert.ok(ids.has("readiness_blocked"));
    assert.ok(ids.has("governance_warning_flag"));
    assert.ok(ids.has("mission_snapshot_readiness"));
    assert.ok(ids.has("dashboard_badge_field"));
    assert.ok(ids.has("reports_readiness_field"));
    assert.ok(ids.has("journal_event_wiring"));
  });
});

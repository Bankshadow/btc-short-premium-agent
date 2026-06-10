import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVANCED_MODULE_REGISTRY,
  getAdvancedModuleDefinition,
  buildAdvancedModuleContextLinks,
  buildAdvancedModulesSnapshot,
} from "./advanced-modules";
import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";

function minimalContext(): AnalysisContext {
  return {
    runId: "ctx-test",
    environment: "PAPER",
    builtAt: new Date().toISOString(),
    market: { spotPrice: null, regime: null, ivHvRatio: null, fundingRate: null },
    positions: [],
    trades: { openCount: 0, closedCount: 0 },
    decisionLog: [],
    journal: [],
    strategyRegistry: null,
    governance: null,
    validation: { killSwitchActive: false, blockers: [] },
    killSwitch: { active: false, reason: null },
    riskPolicy: { profile: "balanced", blockNewTrades: false, triggeredLimits: [] },
    learningRecords: [],
    agentScoreboard: { totalLearned: 0, topAgent: null },
    councilState: {
      weightedVerdict: null,
      confidence: null,
      riskVeto: false,
      agentCount: 0,
    },
    simulationState: { available: false, lastRunAt: null },
    incidentState: { openCount: 0, criticalOpen: false, topTitle: null },
    missionSnapshot: null,
    testnetStatus: {
      connected: false,
      configured: false,
      autoExecuteEnabled: false,
      liveLocked: true,
      blocker: null,
    },
    advancedModules: [],
  };
}

describe("advanced modules mvp86", () => {
  it("registers all twelve consolidated modules", () => {
    assert.equal(ADVANCED_MODULE_REGISTRY.length, 12);
    const ids = ADVANCED_MODULE_REGISTRY.map((m) => m.id);
    assert.ok(ids.includes("strategy-registry"));
    assert.ok(ids.includes("debug"));
  });

  it("marks metadata modules as advisory and not engine-read", () => {
    const apiDocs = getAdvancedModuleDefinition("api-docs");
    assert.ok(apiDocs);
    assert.equal(apiDocs.engineReads, false);
    assert.equal(apiDocs.role, "metadata");

    const ledger = getAdvancedModuleDefinition("ledger");
    assert.ok(ledger);
    assert.equal(ledger.role, "metadata");
  });

  it("builds snapshot with engine linkage fields", async () => {
    const snapshot = await buildAdvancedModulesSnapshot({
      context: minimalContext(),
      latestResult: null,
      events: [],
    });
    assert.equal(snapshot.mvp, 86);
    assert.equal(snapshot.modules.length, 12);
    const governance = snapshot.modules.find((m) => m.id === "governance");
    assert.ok(governance);
    assert.equal(governance.usedByCentralEngine, true);
    assert.ok(governance.analysisImpact);
  });

  it("exposes compact links for AnalysisContext", async () => {
    const snapshot = await buildAdvancedModulesSnapshot({
      context: minimalContext(),
      latestResult: null,
      events: [],
    });
    const links = buildAdvancedModuleContextLinks(snapshot);
    assert.equal(links.length, 12);
    assert.ok(links.every((l) => typeof l.engineReads === "boolean"));
    assert.ok(links.every((l) => typeof l.advisoryOnly === "boolean"));
  });
});

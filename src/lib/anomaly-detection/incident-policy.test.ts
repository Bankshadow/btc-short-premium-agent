import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it } from "node:test";
import {
  findMissionPausingCriticalIncident,
  hasTradeBlockingCriticalIncident,
  isMissionPausingCriticalIncident,
  isTradeBlockingCriticalIncident,
  normalizeAnomalySeverity,
  shouldAutoResolveDetectIncident,
  shouldAutoResolveOperationalIncident,
} from "./incident-policy";
import { reconcileIncidents } from "./reconcile-operational-incidents";
import { loadAnomalyIncidents, upsertAnomalyFindings } from "./store";
import type { AnomalyIncident } from "./types";

function incident(
  partial: Partial<AnomalyIncident> & Pick<AnomalyIncident, "anomalyType" | "severity">,
): AnomalyIncident {
  const now = new Date().toISOString();
  return {
    incidentId: partial.incidentId ?? "anm-inc-test",
    anomalyType: partial.anomalyType,
    severity: partial.severity,
    title: partial.title ?? "Test incident",
    evidence: partial.evidence ?? {},
    impactedModules: partial.impactedModules ?? [],
    recommendedAction: partial.recommendedAction ?? "Investigate",
    status: partial.status ?? "OPEN",
    fingerprint: partial.fingerprint ?? `${partial.anomalyType}:test`,
    autoCreated: partial.autoCreated ?? true,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    resolvedAt: partial.resolvedAt ?? null,
    resolvedBy: partial.resolvedBy ?? null,
    resolutionNote: partial.resolutionNote ?? null,
  };
}

async function withTempDataDir(run: () => Promise<void>) {
  const prevMode = process.env.AUTOMATION_PRIMARY_MODE;
  const prevData = process.env.JOURNAL_DATA_DIR;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "anm-pol-"));
  process.env.JOURNAL_DATA_DIR = tempDir;
  try {
    await run();
  } finally {
    if (prevMode == null) delete process.env.AUTOMATION_PRIMARY_MODE;
    else process.env.AUTOMATION_PRIMARY_MODE = prevMode;
    if (prevData == null) delete process.env.JOURNAL_DATA_DIR;
    else process.env.JOURNAL_DATA_DIR = prevData;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe("incident policy", () => {
  it("caps advisory severities on testnet-primary", () => {
    process.env.AUTOMATION_PRIMARY_MODE = "testnet_perp";
    assert.equal(
      normalizeAnomalySeverity("micro_live_readiness_blocked", "CRITICAL"),
      "WARNING",
    );
    assert.equal(
      normalizeAnomalySeverity("monitor_reliability_degraded", "CRITICAL"),
      "CRITICAL",
    );
  });

  it("does not cap severities on full_desk", () => {
    process.env.AUTOMATION_PRIMARY_MODE = "full_desk";
    assert.equal(
      normalizeAnomalySeverity("micro_live_readiness_blocked", "CRITICAL"),
      "CRITICAL",
    );
  });

  it("excludes advisory incidents from mission pause on testnet-primary", () => {
    process.env.AUTOMATION_PRIMARY_MODE = "testnet_perp";
    const readiness = incident({
      anomalyType: "micro_live_readiness_blocked",
      severity: "CRITICAL",
    });
    const monitor = incident({
      anomalyType: "monitor_reliability_degraded",
      severity: "CRITICAL",
    });
    assert.equal(isMissionPausingCriticalIncident(readiness), false);
    assert.equal(isTradeBlockingCriticalIncident(readiness), false);
    assert.equal(isMissionPausingCriticalIncident(monitor), true);
    assert.equal(findMissionPausingCriticalIncident([readiness, monitor])?.anomalyType, "monitor_reliability_degraded");
  });

  it("auto-resolves operational incidents when runtime clears", async () => {
    await withTempDataDir(async () => {
      process.env.AUTOMATION_PRIMARY_MODE = "testnet_perp";
      await upsertAnomalyFindings([
        {
          anomalyType: "monitor_reliability_degraded",
          severity: "CRITICAL",
          title: "Monitor degraded",
          evidence: { orphan: "DOGEUSDT" },
          impactedModules: ["Monitor"],
          recommendedAction: "Reconcile positions",
          fingerprint: "monitor_reliability_degraded:doge",
        },
      ]);

      const open = await loadAnomalyIncidents();
      assert.equal(open.length, 1);
      assert.equal(open[0].status, "OPEN");

      const shouldStay = shouldAutoResolveOperationalIncident(open[0], {
        monitorHealthy: false,
        monitorMismatches: ["DOGEUSDT"],
        readinessStatus: "BLOCKED",
      });
      assert.equal(shouldStay, false);

      const result = await reconcileIncidents({
        operational: {
          monitorHealthy: true,
          monitorMismatches: [],
          readinessStatus: "READY",
        },
      });
      assert.equal(result.resolvedCount, 1);
      const after = await loadAnomalyIncidents();
      assert.equal(after[0].status, "RESOLVED");
      assert.equal(after[0].resolvedBy, "SYSTEM");
      assert.equal(hasTradeBlockingCriticalIncident(after), false);
    });
  });

  it("auto-resolves detect-managed incidents when fingerprint absent", () => {
    const stale = incident({
      anomalyType: "exchange_disconnected",
      severity: "CRITICAL",
      fingerprint: "exchange_disconnected:gone",
    });
    assert.equal(
      shouldAutoResolveDetectIncident(stale, new Set(["exchange_disconnected:active"])),
      true,
    );
    assert.equal(
      shouldAutoResolveDetectIncident(
        stale,
        new Set(["exchange_disconnected:gone"]),
      ),
      false,
    );
  });
});

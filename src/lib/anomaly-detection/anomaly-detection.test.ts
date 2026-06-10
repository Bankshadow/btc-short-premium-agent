import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it } from "node:test";
import {
  evaluateRiskyActionGate,
  loadAnomalyIncidents,
  updateAnomalyIncident,
  upsertAnomalyFindings,
} from "./index";

async function withTempDataDir(run: () => Promise<void>) {
  const prev = process.env.JOURNAL_DATA_DIR;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "anm-det-"));
  process.env.JOURNAL_DATA_DIR = tempDir;
  try {
    await run();
  } finally {
    if (prev == null) {
      delete process.env.JOURNAL_DATA_DIR;
    } else {
      process.env.JOURNAL_DATA_DIR = prev;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe("anomaly detection incident store", () => {
  it("auto-creates incident with required fields", async () => {
    await withTempDataDir(async () => {
      const incidents = await upsertAnomalyFindings([
        {
          anomalyType: "exchange_disconnected",
          severity: "CRITICAL",
          title: "Exchange disconnected",
          evidence: { connected: false },
          impactedModules: ["Command Center"],
          recommendedAction: "Check exchange credentials",
          fingerprint: "exchange_disconnected:test",
        },
      ]);

      assert.equal(incidents.length, 1);
      const created = incidents[0];
      assert.ok(created.incidentId.startsWith("anm-inc-"));
      assert.equal(created.severity, "CRITICAL");
      assert.equal(created.status, "OPEN");
      assert.equal(created.autoCreated, true);
      assert.ok(created.title.length > 0);
      assert.ok(Array.isArray(created.impactedModules));
      assert.equal(typeof created.recommendedAction, "string");
    });
  });

  it("blocks risky actions when critical incident open", async () => {
    await withTempDataDir(async () => {
      process.env.AUTOMATION_PRIMARY_MODE = "full_desk";
      await upsertAnomalyFindings([
        {
          anomalyType: "duplicate_order",
          severity: "CRITICAL",
          title: "Duplicate order detected",
          evidence: { duplicate: true },
          impactedModules: ["Testnet Monitor"],
          recommendedAction: "Pause auto execute",
          fingerprint: "duplicate_order:gate-test",
        },
      ]);

      const gate = await evaluateRiskyActionGate("live execute");
      assert.equal(gate.allowed, false);
      assert.ok((gate.reason ?? "").includes("CRITICAL"));
      assert.equal(gate.criticalIncidentIds.length, 1);
    });
  });

  it("prevents AI from auto-resolving critical incidents", async () => {
    await withTempDataDir(async () => {
      await upsertAnomalyFindings([
        {
          anomalyType: "duplicate_order",
          severity: "CRITICAL",
          title: "Duplicate order detected",
          evidence: { duplicate: true },
          impactedModules: ["Testnet Monitor"],
          recommendedAction: "Pause auto execute",
          fingerprint: "duplicate_order:test",
        },
      ]);
      const incidents = await loadAnomalyIncidents();
      const target = incidents[0];
      await assert.rejects(
        async () => {
          await updateAnomalyIncident(target.incidentId, {
            status: "RESOLVED",
            actor: "AI",
          });
        },
        /AI cannot auto-resolve CRITICAL incidents/,
      );
    });
  });
});

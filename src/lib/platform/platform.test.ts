import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPermission, permissionsForRole, mapLegacyDeskRole } from "./permissions";
import { evaluateLiveEnableGate } from "./live-enable-gate";
import { scopedStorageKey } from "./scoped-storage";

describe("P-MVP 1 Platform Core", () => {
  it("assigns OWNER all permissions", () => {
    const perms = permissionsForRole("OWNER");
    assert.equal(perms.canManageLiveSettings, true);
    assert.equal(perms.canTriggerKillSwitch, true);
  });

  it("restricts kill switch to OWNER and RISK_MANAGER", () => {
    assert.equal(hasPermission("ADMIN", "canTriggerKillSwitch"), false);
    assert.equal(hasPermission("RISK_MANAGER", "canTriggerKillSwitch"), true);
    assert.equal(hasPermission("OWNER", "canTriggerKillSwitch"), true);
  });

  it("allows only OWNER and ADMIN to manage live settings", () => {
    assert.equal(hasPermission("OWNER", "canManageLiveSettings"), true);
    assert.equal(hasPermission("ADMIN", "canManageLiveSettings"), true);
    assert.equal(hasPermission("TRADER", "canManageLiveSettings"), false);
  });

  it("maps legacy OPERATOR role to TRADER", () => {
    assert.equal(mapLegacyDeskRole("OPERATOR"), "TRADER");
  });

  it("blocks LIVE_ENABLED without readiness", () => {
    const gate = evaluateLiveEnableGate({
      targetEnvironment: "LIVE_ENABLED",
      readiness: null,
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.blockers.length > 0);
  });

  it("scopes storage keys by workspace", () => {
    const key = scopedStorageKey("decision-log", "ws-test-123");
    assert.ok(key.includes("ws-test-123"));
    assert.ok(key.includes("decision-log"));
  });

  it("blocks VIEWER from running analysis", () => {
    assert.equal(hasPermission("VIEWER", "canRunAnalysis"), false);
    assert.equal(hasPermission("VIEWER", "canViewReports"), true);
  });

  it("allows TRADER paper autopilot but not risk settings", () => {
    assert.equal(hasPermission("TRADER", "canEnablePaperAutopilot"), true);
    assert.equal(hasPermission("TRADER", "canChangeRiskSettings"), false);
    assert.equal(hasPermission("TRADER", "canTriggerKillSwitch"), false);
  });
});

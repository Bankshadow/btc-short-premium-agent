import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCommandCenterReport } from "./evaluate-status";
import { runCommandCenterAction } from "./run-actions";
import type { CommandCenterInput } from "./types";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";

function baseServerContext(): ServerReadinessContext {
  return {
    exchangeStatus: {
      configured: true,
      connected: true,
      network: "testnet",
      baseUrl: "https://api-testnet.bybit.com",
      clockSkewMs: 100,
      wallet: null,
      linearPositions: [],
      optionPositions: [],
      openLinearOrders: [],
      openOptionOrders: [],
      error: null,
      errorCode: null,
    },
    liveExecution: {
      enabled: false,
      configured: true,
      network: "testnet",
      requireDoubleConfirm: true,
    },
    maxLiveNotionalUsd: 500,
    cronSecretConfigured: true,
    supabaseConfigured: false,
    telegramConfigured: true,
    discordEnvConfigured: true,
    deskWebhookConfigured: false,
    llmConfigured: false,
    serverAutomationAllowed: false,
    timestamp: new Date().toISOString(),
  };
}

function baseInput(
  overrides: Partial<CommandCenterInput> = {},
): CommandCenterInput {
  return {
    entries: [],
    orders: [],
    riskProfile: "balanced",
    serverContext: baseServerContext(),
    governance: {
      pauseAnalysis: false,
      pausePaperAutoOpen: false,
      disableAggressiveMode: false,
      disableAlerts: false,
      safeMode: false,
      operatorPaused: false,
      operatorPauseReason: "",
      operatorPausedAt: null,
      cooldownUntil: null,
      operatorRole: "OPERATOR",
      operatorName: "Test",
    },
    incidents: [],
    ...overrides,
  };
}

describe("command center MVP 40", () => {
  it("reports BLOCKED when live readiness not met on empty journal", () => {
    const report = buildCommandCenterReport(baseInput());
    assert.equal(report.status, "BLOCKED");
    assert.ok(report.blockers.some((b) => b.id === "live_readiness_fail"));
  });

  it("reports BLOCKED when exchange disconnected", () => {
    const ctx = baseServerContext();
    ctx.exchangeStatus.connected = false;
    ctx.exchangeStatus.error = "Auth failed";
    const report = buildCommandCenterReport(
      baseInput({ serverContext: ctx }),
    );
    assert.equal(report.status, "BLOCKED");
    assert.ok(report.blockers.some((b) => b.id === "exchange_disconnected"));
  });

  it("reports EMERGENCY on critical incident", () => {
    const report = buildCommandCenterReport(
      baseInput({
        incidents: [
          {
            id: "i1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: "risk_breach",
            severity: "critical",
            description: "Test",
            affectedDecisionId: null,
            rootCause: "",
            correctiveAction: "",
            status: "open",
          },
        ],
      }),
    );
    assert.equal(report.status, "EMERGENCY");
    assert.ok(report.blockers.some((b) => b.id === "unresolved_critical_incident"));
  });

  it("blocks missing alert channel when alerts not disabled", () => {
    const ctx = baseServerContext();
    ctx.telegramConfigured = false;
    ctx.discordEnvConfigured = false;
    ctx.deskWebhookConfigured = false;
    const report = buildCommandCenterReport(
      baseInput({ serverContext: ctx }),
    );
    assert.ok(report.blockers.some((b) => b.id === "missing_alert_channel"));
  });

  it("pause analysis action is risk-reducing only", () => {
    const result = runCommandCenterAction({ action: "PAUSE_ANALYSIS" });
    assert.equal(result.ok, true);
    assert.equal(result.riskReducingOnly, true);
    assert.equal(result.governancePatch?.pauseAnalysis, true);
  });

  it("rejects risk-increasing action names", () => {
    const result = runCommandCenterAction({
      action: "ENABLE_LIVE" as "PAUSE_ANALYSIS",
    });
    assert.equal(result.ok, false);
  });

  it("kill switch action returns governance and kill patches", () => {
    const result = runCommandCenterAction({
      action: "TRIGGER_KILL_SWITCH",
      operatorNote: "test",
    });
    assert.equal(result.ok, true);
    assert.equal(result.governancePatch?.operatorPaused, true);
    assert.equal(result.killSwitchPatch?.operatorPaused, true);
    assert.equal(result.clientMustPersist, true);
  });

  it("includes real-time risk report", () => {
    const report = buildCommandCenterReport(baseInput());
    assert.ok(report.realTimeRisk);
    assert.ok(["SAFE", "CAUTION", "BLOCKED", "EMERGENCY"].includes(report.realTimeRisk.riskStatus));
  });

  it("includes options portfolio risk report", () => {
    const report = buildCommandCenterReport(baseInput());
    assert.ok(report.optionsRisk);
    assert.equal(report.optionsRisk.cannotPlaceOrders, true);
    assert.equal(report.optionsRisk.greeksEstimable, false);
  });

  it("MVP 41C reality check on empty journal: BLOCKED live, CAUTION paper, SAFE analysis", () => {
    const report = buildCommandCenterReport(baseInput());
    assert.ok(report.realityCheck);
    assert.equal(report.realityCheck.domainStatuses.liveTrading, "BLOCKED");
    assert.equal(report.realityCheck.domainStatuses.paperLearning, "CAUTION");
    assert.equal(report.realityCheck.domainStatuses.analysisOnly, "SAFE");
    assert.equal(report.realityCheck.expectedProductionPosture, true);
    assert.ok(
      report.realityCheck.checks.some(
        (c) => c.id === "no_resolved_decision_logs" && c.status === "FAIL",
      ),
    );
    assert.ok(
      report.realityCheck.checks.some(
        (c) => c.id === "supabase_sync_off" && c.status === "FAIL",
      ),
    );
    assert.ok(report.recommendedActions.includes("Keep live disabled"));
    assert.ok(report.recommendedActions.includes("Run analysis"));
  });

  it("MVP 41C flags exchange status unknown when not configured", () => {
    const ctx = baseServerContext();
    ctx.exchangeStatus.configured = false;
    ctx.exchangeStatus.connected = false;
    const report = buildCommandCenterReport(
      baseInput({ serverContext: ctx }),
    );
    assert.ok(
      report.realityCheck.checks.some(
        (c) => c.id === "exchange_status_unknown" && c.status === "FAIL",
      ),
    );
  });

  it("MVP 41C flags governance placeholder and local audit", () => {
    const report = buildCommandCenterReport(
      baseInput({
        governance: {
          pauseAnalysis: false,
          pausePaperAutoOpen: false,
          disableAggressiveMode: false,
          disableAlerts: false,
          safeMode: false,
          operatorPaused: false,
          operatorPauseReason: "",
          operatorPausedAt: null,
          cooldownUntil: null,
          operatorRole: "OPERATOR",
          operatorName: "Desk Operator",
        },
      }),
    );
    assert.ok(report.realityCheck.governancePlaceholder);
    assert.equal(report.realityCheck.auditDatabaseBacked, false);
    assert.ok(
      report.realityCheck.checks.some(
        (c) => c.id === "governance_local_placeholder" && c.status === "FAIL",
      ),
    );
    assert.ok(
      report.realityCheck.checks.some(
        (c) => c.id === "audit_not_database_backed" && c.status === "FAIL",
      ),
    );
  });

  it("export daily report requires snapshot", () => {
    const without = runCommandCenterAction({ action: "EXPORT_DAILY_REPORT" });
    assert.equal(without.ok, false);

    const report = buildCommandCenterReport(baseInput());
    const withReport = runCommandCenterAction(
      { action: "EXPORT_DAILY_REPORT" },
      report,
    );
    assert.equal(withReport.ok, true);
    assert.ok(withReport.exportReport?.includes("Command Center Daily Report"));
  });
});

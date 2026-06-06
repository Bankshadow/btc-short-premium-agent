import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlatformHealthReport,
  resolveLiveTradingPosture,
} from "./build-health-score";
import { observabilityCommandCenterBlockers } from "./observability-blockers";
import { observabilityToPolicyState } from "./observability-blockers";
import type { ObservabilitySignals } from "./types";

function baseSignals(overrides: Partial<ObservabilitySignals> = {}): ObservabilitySignals {
  return {
    workspaceId: "ws-test",
    collectedAt: new Date().toISOString(),
    api: { analyzeRouteOk: true, cronConfigured: true, lastCheckAt: new Date().toISOString() },
    exchange: { configured: true, connected: true, network: "testnet", error: null, clockSkewMs: 10 },
    database: {
      configured: true,
      backend: "file",
      liveExecutionBlocked: false,
      liveBlockReason: null,
      writeFailures: 0,
    },
    automation: {
      paused: false,
      failedJobCount: 0,
      consecutiveFailureTypes: [],
      lastRunStatus: "SUCCESS",
      lastRunAt: new Date().toISOString(),
    },
    alerts: {
      telegramConfigured: true,
      discordConfigured: false,
      deskWebhookConfigured: false,
      anyChannelConfigured: true,
      recentDeliveryFailures: 0,
      lastDeliveryAt: null,
    },
    marketData: {
      btcPrice: 90000,
      dataTrustGrade: "GOOD",
      staleWarning: null,
      analysisLatencyMs: 1200,
      lastAnalysisAt: new Date().toISOString(),
    },
    errorRate1h: 0,
    policyBlocks1h: 0,
    liveBlockers: [],
    failedJobs: [],
    recentPolicyBlocks: [],
    ...overrides,
  };
}

describe("P-MVP 7 Observability", () => {
  it("scores healthy platform when signals are clear", () => {
    const report = buildPlatformHealthReport(baseSignals());
    assert.equal(report.overallLevel, "HEALTHY");
    assert.equal(report.liveTradingPosture, "SAFE");
    assert.equal(report.commandCenterShouldBlock, false);
    assert.equal(report.dimensions.length, 6);
  });

  it("blocks live when database health fails", () => {
    const report = buildPlatformHealthReport(
      baseSignals({
        database: {
          configured: true,
          backend: "file",
          liveExecutionBlocked: true,
          liveBlockReason: "live_trades write failures",
          writeFailures: 3,
        },
      }),
    );
    assert.equal(report.liveTradingPosture, "BLOCKED");
    assert.equal(report.commandCenterShouldBlock, true);
    const data = report.dimensions.find((d) => d.dimension === "data");
    assert.equal(data?.level, "CRITICAL");
  });

  it("sets CAUTION when alert delivery fails", () => {
    const posture = resolveLiveTradingPosture(
      buildPlatformHealthReport(
        baseSignals({
          alerts: {
            telegramConfigured: true,
            discordConfigured: false,
            deskWebhookConfigured: false,
            anyChannelConfigured: true,
            recentDeliveryFailures: 2,
            lastDeliveryAt: null,
          },
        }),
      ).dimensions,
      baseSignals({
        alerts: {
          telegramConfigured: true,
          discordConfigured: false,
          deskWebhookConfigured: false,
          anyChannelConfigured: true,
          recentDeliveryFailures: 2,
          lastDeliveryAt: null,
        },
      }),
    );
    assert.equal(posture, "CAUTION");
  });

  it("feeds command center blockers on critical observability", () => {
    const report = buildPlatformHealthReport(
      baseSignals({
        liveBlockers: ["Kill switch active", "Policy EXECUTE_LIVE_PERP: blocked"],
        policyBlocks1h: 5,
      }),
    );
    report.commandCenterShouldBlock = true;
    const blockers = observabilityCommandCenterBlockers(report);
    assert.ok(blockers.some((b) => b.id === "observability_critical"));
  });

  it("maps observability to policy state for live enforcement", () => {
    const report = buildPlatformHealthReport(
      baseSignals({
        database: {
          configured: true,
          backend: "file",
          liveExecutionBlocked: true,
          liveBlockReason: "blocked",
          writeFailures: 1,
        },
      }),
    );
    const policy = observabilityToPolicyState(report);
    assert.equal(policy?.databaseHealthy, false);
    assert.equal(policy?.liveTradingPosture, "BLOCKED");
  });
});

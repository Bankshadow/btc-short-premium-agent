import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveEngineHealthCapabilities,
  resolveEngineHealthSummary,
  sortEngineHealthChecks,
} from "./resolve-engine-health";
import { ENGINE_HEALTH_CHECK_ORDER } from "./types";
import type { EngineHealthCheck } from "./types";

function mockCheck(
  partial: Partial<EngineHealthCheck> & Pick<EngineHealthCheck, "id" | "status" | "message">,
): EngineHealthCheck {
  return {
    label: partial.id,
    detail: null,
    lastUpdatedAt: null,
    affectsAnalyze: false,
    affectsTrade: false,
    affectsLearn: false,
    ...partial,
  };
}

describe("analysis engine health mvp87", () => {
  it("orders checks per ENGINE_HEALTH_CHECK_ORDER", () => {
    const checks = sortEngineHealthChecks([
      mockCheck({ id: "reports_updating", status: "OK", message: "ok" }),
      mockCheck({ id: "market_data_fresh", status: "OK", message: "ok" }),
    ]);
    assert.equal(checks[0].id, "market_data_fresh");
    assert.equal(checks[1].id, "reports_updating");
  });

  it("resolves summary as worst status", () => {
    const checks = [
      mockCheck({ id: "market_data_fresh", status: "OK", message: "ok" }),
      mockCheck({ id: "kill_switch_readable", status: "BLOCKED", message: "paused" }),
    ];
    const summary = resolveEngineHealthSummary(checks);
    assert.equal(summary.summary, "BLOCKED");
    assert.equal(summary.summaryLabel, "Blocked");
  });

  it("builds analyze/trade/learn capability blockers", () => {
    const checks = [
      mockCheck({
        id: "market_data_fresh",
        status: "BLOCKED",
        message: "No market",
        affectsAnalyze: true,
        affectsTrade: true,
      }),
      mockCheck({
        id: "learning_queue_writable",
        status: "BLOCKED",
        message: "No learning store",
        affectsLearn: true,
      }),
    ];
    const caps = resolveEngineHealthCapabilities(checks);
    assert.equal(caps.analyze.allowed, false);
    assert.ok(caps.analyze.blockers.includes("No market"));
    assert.equal(caps.trade.allowed, false);
    assert.equal(caps.learn.allowed, false);
    assert.ok(caps.learn.blockers.includes("No learning store"));
  });

  it("defines thirteen health check ids", () => {
    assert.equal(ENGINE_HEALTH_CHECK_ORDER.length, 13);
  });
});

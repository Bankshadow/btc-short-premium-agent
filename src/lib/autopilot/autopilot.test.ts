import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLearningStatus } from "./build-learning-status";
import { runAutopilotCycle } from "./run-autopilot";
import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
import { resolveEffectiveMode } from "./config";
import { DEFAULT_AUTOPILOT_SETTINGS } from "./config";
import {
  countPaperTradesOpenedToday,
  resolveAutopilotPaperEffects,
} from "./apply-paper-effects";

describe("autopilot MVP 41", () => {
  it("resolves effective mode with live locked", () => {
    assert.equal(resolveEffectiveMode(DEFAULT_AUTOPILOT_SETTINGS), "ANALYSIS_ONLY");
    assert.equal(
      resolveEffectiveMode({
        ...DEFAULT_AUTOPILOT_SETTINGS,
        paperAutopilotEnabled: true,
      }),
      "PAPER_AUTOPILOT",
    );
    assert.equal(
      resolveEffectiveMode({
        ...DEFAULT_AUTOPILOT_SETTINGS,
        autopilotEnabled: false,
      }),
      "OFF",
    );
  });

  it("builds learning status for empty journal", () => {
    const ls = buildLearningStatus({
      entries: [],
      orders: [],
      riskProfile: "balanced",
    });
    assert.equal(ls.resolvedOutcomesCount, 0);
    assert.ok(ls.label.includes("not learning"));
  });

  it("generates operator actions when no logs", () => {
    const actions = buildOperatorActionQueue({
      entries: [],
      orders: [],
      riskProfile: "balanced",
    });
    assert.ok(actions.some((a) => a.type === "RUN_ANALYSIS"));
  });

  it("runs autopilot cycle blocked on empty desk", async () => {
    const result = await runAutopilotCycle({
      entries: [],
      orders: [],
      riskProfile: "balanced",
      settings: DEFAULT_AUTOPILOT_SETTINGS,
    });
    assert.equal(result.cannotEnableLiveAutopilot, true);
    assert.ok(["COMPLETED", "BLOCKED", "FAILED"].includes(result.status));
    assert.ok(result.modulesRun.length > 0);
    assert.ok(result.recommendedAction.length > 0);
  });

  it("returns idle when autopilot disabled", async () => {
    const result = await runAutopilotCycle({
      settings: { ...DEFAULT_AUTOPILOT_SETTINGS, autopilotEnabled: false },
    });
    assert.equal(result.status, "IDLE");
    assert.equal(result.mode, "OFF");
  });

  it("respects daily paper trade limit", () => {
    const today = new Date().toISOString();
    const orders = Array.from({ length: 3 }, (_, i) => ({
      id: `o-${i}`,
      decisionLogId: `l-${i}`,
      committeeVerdict: "TRADE" as const,
      instrument: "sell_call" as const,
      symbol: "BTC",
      side: "short" as const,
      entryBtcPrice: 90000,
      entryOptionMark: 1000,
      strike: 95000,
      sizePct: 1,
      notionalUsd: 100,
      status: "OPEN" as const,
      openedAt: today,
      closedAt: null,
      exitBtcPrice: null,
      realizedPnlPct: null,
      unrealizedPnlPct: null,
      lastMarkAt: null,
      lastMarkBtcPrice: null,
      openedBy: "committee_auto" as const,
      notes: "",
      paperMode: "STRICT_PAPER" as const,
    }));
    assert.equal(countPaperTradesOpenedToday(orders), 3);
    const effects = resolveAutopilotPaperEffects(
      {
        ...DEFAULT_AUTOPILOT_SETTINGS,
        paperAutopilotEnabled: true,
        maxPaperTradesPerDay: 3,
      },
      orders,
    );
    assert.equal(effects.skipAutoOpen, true);
  });
});

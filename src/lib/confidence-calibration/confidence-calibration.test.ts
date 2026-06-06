import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCalibratedConfidence,
  applyCommitteeCalibration,
  resolveCalibrationSizeMultiplier,
} from "./apply-calibration";
import { buildConfidenceCalibrationProfile } from "./build-profile";
import { collectCalibrationSamples } from "./collect-samples";
import type { ConfidenceCalibrationSample } from "./types";

function sample(
  confidence: number,
  win: boolean,
  pnl = win ? 2 : -2,
): ConfidenceCalibrationSample {
  return {
    sampleId: `s-${confidence}-${win}`,
    decisionLogId: `d-${confidence}`,
    confidenceBeforeTrade: confidence,
    actualWin: win,
    pnlPct: pnl,
    result: win ? "WIN" : "LOSS",
    source: "testnet_close",
    evaluatedAt: new Date().toISOString(),
  };
}

describe("Confidence calibration (MVP 83)", () => {
  it("builds overconfident high bucket example", () => {
    const samples: ConfidenceCalibrationSample[] = [];
    for (let i = 0; i < 6; i++) {
      samples.push(sample(85, i < 3));
    }
    const profile = buildConfidenceCalibrationProfile({ samples });
    const high = profile.buckets.find((b) => b.bucketId === "80-100");
    assert.ok(high);
    assert.equal(high!.sampleCount, 6);
    assert.equal(high!.winRate, 50);
    assert.ok(high!.avgConfidence >= 80);
    assert.ok(high!.overconfident);
    assert.ok(high!.calibrationGap >= 10);
  });

  it("never increases calibrated confidence above raw", () => {
    const profile = buildConfidenceCalibrationProfile({
      samples: [sample(55, true), sample(58, true), sample(52, true)],
    });
    const raw = 55;
    const calibrated = applyCalibratedConfidence(raw, profile);
    assert.ok(calibrated <= raw);
  });

  it("reduces size multiplier when overconfident", () => {
    const profile = buildConfidenceCalibrationProfile({
      samples: Array.from({ length: 5 }, (_, i) => sample(90, i < 2)),
    });
    const mult = resolveCalibrationSizeMultiplier(90, profile);
    assert.ok(mult < 1);
    assert.ok(mult >= 0.5);
  });

  it("only reduces committee trade score", () => {
    const profile = buildConfidenceCalibrationProfile({
      samples: Array.from({ length: 4 }, () => sample(88, false)),
    });
    const raw = 72;
    const adjusted = applyCommitteeCalibration(raw, profile, 88);
    assert.ok(adjusted <= raw);
  });

  it("collects samples from evaluations with playbook confidence", () => {
    const samples = collectCalibrationSamples({
      evaluations: [
        {
          evaluationId: "e1",
          decisionLogId: "log-1",
          generatedAt: new Date().toISOString(),
          source: "testnet_close",
          marketRegime: "RANGE",
          asset: "BTCUSDT",
          strategies: ["futures_long"],
          pnlPct: 1.5,
          tradeWouldWin: true,
          finalVerdict: "TRADE",
          agentEvaluations: [],
          committeeEvaluation: {} as never,
          improvementHints: [],
        },
      ],
      entries: [
        {
          id: "log-1",
          timestamp: new Date().toISOString(),
          btcPrice: 65000,
          marketRegime: "RANGE",
          agentOutputs: [],
          finalVerdict: "TRADE",
          riskVeto: false,
          topReasons: [],
          actionPlan: "",
          outcomeStatus: "RESOLVED",
          paperPnl: 1.5,
          reflection: null,
          playbookConfidence: 82,
        },
      ],
    });
    assert.equal(samples.length, 1);
    assert.equal(samples[0]?.confidenceBeforeTrade, 82);
    assert.equal(samples[0]?.actualWin, true);
  });
});

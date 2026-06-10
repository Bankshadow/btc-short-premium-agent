import { CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP } from "@/lib/confidence-calibration/config";
import type {
  ConfidenceCalibrationReport,
  IntegratedCalibrationSample,
  TestnetAgentScoreboardV2Row,
  TestnetAgentScoreboardV2Segment,
} from "./types";

const UNDERCONFIDENT_GAP = -8;

export function buildAgentScoreboardV2FromSamples(input: {
  samples: IntegratedCalibrationSample[];
  report: ConfidenceCalibrationReport;
}): TestnetAgentScoreboardV2Segment {
  const byAgent = new Map<string, IntegratedCalibrationSample[]>();
  for (const sample of input.samples) {
    const key = sample.sourceAgent ?? "UNKNOWN";
    const list = byAgent.get(key) ?? [];
    list.push(sample);
    byAgent.set(key, list);
  }

  const rows: TestnetAgentScoreboardV2Row[] = [...byAgent.entries()]
    .map(([sourceAgent, agentSamples]) => {
      const wins = agentSamples.filter((s) => s.actualWin).length;
      const avgStatedConfidence = Math.round(
        agentSamples.reduce((s, r) => s + r.confidenceBeforeTrade, 0) /
          agentSamples.length,
      );
      const actualWinRate = Math.round((wins / agentSamples.length) * 1000) / 10;
      const calibrationGap = Math.round((avgStatedConfidence - actualWinRate) * 10) / 10;
      const overconfident = calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP;
      const underconfident = calibrationGap <= UNDERCONFIDENT_GAP;
      return {
        sourceAgent,
        sampleCount: agentSamples.length,
        avgStatedConfidence,
        actualWinRate,
        calibrationGap,
        overconfident,
        underconfident,
        downweightRecommended: overconfident && agentSamples.length >= 2,
      };
    })
    .sort((a, b) => b.calibrationGap - a.calibrationGap);

  const overconfidentBuckets = input.report.bucketStats.filter((b) => b.overconfident);
  const globalCalibrationGap =
    overconfidentBuckets.length > 0
      ? Math.round(
          overconfidentBuckets.reduce((s, b) => s + b.calibrationGap, 0) /
            overconfidentBuckets.length,
        )
      : 0;

  return {
    environment: "TESTNET",
    totalSamples: input.samples.length,
    rows,
    globalCalibrationGap,
    updatedAt: new Date().toISOString(),
  };
}

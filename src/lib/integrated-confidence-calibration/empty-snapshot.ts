import type { IntegratedConfidenceCalibrationSnapshot } from "./types";
import { buildConfidenceCalibrationReport } from "./build-calibration-report";
import {
  INTEGRATED_CONFIDENCE_CALIBRATION_LABEL,
  INTEGRATED_CONFIDENCE_CALIBRATION_MVP,
} from "./types";

/** Client-safe empty snapshot — no fs imports. */
export function emptyIntegratedConfidenceCalibration(): IntegratedConfidenceCalibrationSnapshot {
  const report = buildConfidenceCalibrationReport({ samples: [] });
  return {
    mvp: INTEGRATED_CONFIDENCE_CALIBRATION_MVP,
    label: INTEGRATED_CONFIDENCE_CALIBRATION_LABEL,
    report,
    profile: null,
    agentScoreboardV2: {
      environment: "TESTNET",
      totalSamples: 0,
      rows: [],
      globalCalibrationGap: 0,
      updatedAt: new Date().toISOString(),
    },
    autoAgentWeightChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

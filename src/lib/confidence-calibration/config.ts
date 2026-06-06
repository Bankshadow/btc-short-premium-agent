import type { ConfidenceBucketDefinition } from "./types";

export const CONFIDENCE_CALIBRATION_STORE_FILE = "confidence-calibration.json";
export const CONFIDENCE_CALIBRATION_MAX_SAMPLES = 200;
export const CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES = 3;
export const CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP = 10;

export const CONFIDENCE_BUCKETS: ConfidenceBucketDefinition[] = [
  { id: "0-49", min: 0, max: 49, label: "0–49%" },
  { id: "50-59", min: 50, max: 59, label: "50–59%" },
  { id: "60-69", min: 60, max: 69, label: "60–69%" },
  { id: "70-79", min: 70, max: 79, label: "70–79%" },
  { id: "80-100", min: 80, max: 100, label: "80–100%" },
];

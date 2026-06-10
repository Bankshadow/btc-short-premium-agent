"use client";

import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";

export default function ConfidenceCalibrationBadge({
  calibration,
}: {
  calibration: IntegratedConfidenceCalibrationSnapshot | null | undefined;
}) {
  const report = calibration?.report;
  if (!report || report.sampleCount === 0) return null;

  const style = report.overconfidenceDetected
    ? "text-amber-300 border-amber-900/50 bg-amber-950/20"
    : report.underconfidenceDetected
      ? "text-cyan-300 border-cyan-900/50 bg-cyan-950/20"
      : "text-emerald-300 border-emerald-900/50 bg-emerald-950/20";

  const label = report.overconfidenceDetected
    ? "Overconfident"
    : report.underconfidenceDetected
      ? "Underconfident"
      : "Calibrated";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`}
      data-mvp="77"
      title={report.confidenceAdjustmentRecommendation}
    >
      {label}
      <span className="opacity-70">· ×{report.recommendedSizeMultiplier}</span>
    </span>
  );
}

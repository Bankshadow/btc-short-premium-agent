"use client";

import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import { CONFIDENCE_CALIBRATION_SAFETY_NOTICE } from "@/lib/confidence-calibration/types";

function gapClass(gap: number): string {
  if (gap >= 15) return "text-rose-300";
  if (gap >= 8) return "text-amber-300";
  if (gap <= 0) return "text-emerald-300";
  return "text-zinc-300";
}

export default function IntegratedConfidenceCalibrationPanel({
  calibration,
}: {
  calibration: IntegratedConfidenceCalibrationSnapshot | null | undefined;
}) {
  const report = calibration?.report;
  if (!report || report.sampleCount === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Close testnet trades with decisionLogId and AI confidence to compare stated
          confidence vs actual win rate.
        </p>
        <p className="text-[10px] text-zinc-600">{CONFIDENCE_CALIBRATION_SAFETY_NOTICE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-mvp="77">
      <div>
        <p className="text-sm text-zinc-300">
          {report.confidenceAdjustmentRecommendation}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {report.sampleCount} matched trade(s) · size multiplier ×
          {report.recommendedSizeMultiplier}
          {report.overconfidenceDetected && " · overconfidence detected"}
          {report.underconfidenceDetected && " · underconfidence detected"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Bucket</th>
              <th className="py-2 pr-3 font-medium">n</th>
              <th className="py-2 pr-3 font-medium">Avg conf</th>
              <th className="py-2 pr-3 font-medium">Win rate</th>
              <th className="py-2 pr-3 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {report.bucketStats.map((b) => (
              <tr key={b.bucketId} className="border-b border-zinc-900/80 text-zinc-300">
                <td className="py-2 pr-3">
                  {b.label}
                  {b.overconfident && (
                    <span className="ml-1 text-[10px] text-rose-400">over</span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono">{b.sampleCount}</td>
                <td className="py-2 pr-3 font-mono">{b.avgConfidence}%</td>
                <td className="py-2 pr-3 font-mono">{b.winRate}%</td>
                <td className={`py-2 pr-3 font-mono ${gapClass(b.calibrationGap)}`}>
                  {b.calibrationGap > 0 ? `+${b.calibrationGap}` : b.calibrationGap}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.affectedAgents.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-violet-400/80">
            Agent scoreboard v2 — calibration alignment
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {report.affectedAgents.slice(0, 5).map((a) => (
              <li key={a.agentName}>
                {a.agentName} · conf {a.avgStatedConfidence}% → win {a.actualWinRate}%
                {a.downweightRecommended && (
                  <span className="text-amber-400/90"> · downweight advisory</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.affectedStrategies.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-cyan-400/80">
            Affected strategies
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {report.affectedStrategies.slice(0, 5).map((s) => (
              <li key={s.strategyTag}>
                {s.strategyTag} · gap {s.calibrationGap}%
                {s.dominantRegime ? ` · ${s.dominantRegime}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-zinc-600">{CONFIDENCE_CALIBRATION_SAFETY_NOTICE}</p>
    </div>
  );
}

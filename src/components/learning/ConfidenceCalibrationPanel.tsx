"use client";

import type { ConfidenceCalibrationProfile } from "@/lib/confidence-calibration/types";
import { CONFIDENCE_CALIBRATION_SAFETY_NOTICE } from "@/lib/confidence-calibration/types";

function gapClass(gap: number): string {
  if (gap >= 15) return "text-rose-300";
  if (gap >= 8) return "text-amber-300";
  if (gap <= 0) return "text-emerald-300";
  return "text-zinc-300";
}

export default function ConfidenceCalibrationPanel({
  profile,
  busy,
  onRecompute,
}: {
  profile: ConfidenceCalibrationProfile | null;
  busy?: boolean;
  onRecompute?: () => void;
}) {
  if (!profile || profile.totalSamples === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          No calibration samples yet. Close testnet trades and run self-learning evaluation to
          compare stated confidence vs actual win rate.
        </p>
        {onRecompute && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecompute}
            className="rounded-lg border border-violet-800/60 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
          >
            {busy ? "..." : "Build calibration"}
          </button>
        )}
        <p className="text-[10px] text-zinc-600">{CONFIDENCE_CALIBRATION_SAFETY_NOTICE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-300">{profile.headline}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {profile.totalSamples} samples · size multiplier ×
            {profile.recommendedSizeMultiplier} · committee ×
            {profile.recommendedCommitteeMultiplier}
          </p>
        </div>
        {onRecompute && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecompute}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            {busy ? "..." : "Recompute"}
          </button>
        )}
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
            {profile.buckets.map((b) => (
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

      {profile.overconfidentAgents.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-rose-400/80">
            Overconfident agents (downweighted)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {profile.overconfidentAgents.slice(0, 5).map((a) => (
              <li key={a.agentName}>
                {a.agentName} · cal err {a.calibrationError.toFixed(2)} · hit {a.hitRate}%
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-zinc-600">{CONFIDENCE_CALIBRATION_SAFETY_NOTICE}</p>
    </div>
  );
}

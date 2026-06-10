"use client";

import TradeQualityPanel from "@/components/learning/TradeQualityPanel";
import IntegratedConfidenceCalibrationPanel from "@/components/integrated-confidence-calibration/IntegratedConfidenceCalibrationPanel";
import { DIMENSION_LABELS } from "@/lib/trade-quality-score/config";
import type { IntegratedQualityCalibrationSnapshot } from "@/lib/integrated-quality-calibration/types";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";

export default function IntegratedQualityCalibrationPanel({
  qualityCalibration,
  tradeQuality,
  confidenceCalibration,
}: {
  qualityCalibration?: IntegratedQualityCalibrationSnapshot | null;
  tradeQuality?: IntegratedTradeQualitySnapshot | null;
  confidenceCalibration?: IntegratedConfidenceCalibrationSnapshot | null;
}) {
  const qc = qualityCalibration;
  const tq = tradeQuality ?? (qc ? {
    mvp: 76 as const,
    label: "Integrated Trade Quality",
    summary: qc.tradeQualitySummary,
    scoresByTradeId: qc.tradeQualityScore?.tradeId
      ? { [qc.tradeQualityScore.tradeId]: qc.tradeQualityScore }
      : {},
    autoStrategyChangeAllowed: false as const,
    lastUpdatedAt: qc.lastUpdatedAt,
  } : null);
  const cal = confidenceCalibration ?? (qc ? {
    mvp: 77 as const,
    label: "Integrated AI Confidence Calibration",
    report: qc.confidenceCalibrationReport,
    profile: null,
    agentScoreboardV2: {
      environment: "TESTNET" as const,
      totalSamples: qc.confidenceCalibrationReport.sampleCount,
      rows: [],
      globalCalibrationGap: 0,
      updatedAt: qc.lastUpdatedAt,
    },
    autoAgentWeightChangeAllowed: false as const,
    cannotIncreaseLiveRisk: true as const,
    lastUpdatedAt: qc.lastUpdatedAt,
  } : null);

  if (!qc && !tq && !cal) {
    return <p className="text-sm text-zinc-500">Quality & calibration loading…</p>;
  }

  const dimensionEntries = Object.entries(qc?.avgDimensionScores ?? {});

  return (
    <div className="space-y-5" data-mvp="90">
      {qc?.overconfidenceWarning && (
        <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
          {qc.overconfidenceWarning}
        </p>
      )}

      {qc?.strategyImprovementSuggestion && (
        <p className="rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2 text-xs text-indigo-200">
          Strategy improvement: {qc.strategyImprovementSuggestion}
        </p>
      )}

      {dimensionEntries.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Avg dimension scores (8)
          </p>
          <dl className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
            {dimensionEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between rounded border border-zinc-800/60 px-2 py-1">
                <dt className="text-zinc-500">
                  {DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS] ?? key}
                </dt>
                <dd className="font-mono text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <TradeQualityPanel summary={tq?.summary ?? null} />
      <IntegratedConfidenceCalibrationPanel calibration={cal} />
    </div>
  );
}

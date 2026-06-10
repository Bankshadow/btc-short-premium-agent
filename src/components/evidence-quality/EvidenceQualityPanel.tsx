"use client";

import type {
  EvidenceFieldGap,
  EvidenceQualityLevel,
  EvidenceQualitySnapshot,
  EvidenceTradeAssessment,
} from "@/lib/evidence-quality/types";

const LEVEL_CLASS: Record<EvidenceQualityLevel, string> = {
  GOOD: "text-emerald-300",
  POOR: "text-rose-300",
  INSUFFICIENT: "text-amber-300",
};

function FieldGapRow({ gap }: { gap: EvidenceFieldGap }) {
  return (
    <li className="flex justify-between text-xs text-zinc-400">
      <span>{gap.field.replace(/([A-Z])/g, " $1").trim()}</span>
      <span className="font-mono text-zinc-300">{gap.count}</span>
    </li>
  );
}

function TradeRow({ trade }: { trade: EvidenceTradeAssessment }) {
  return (
    <li className="rounded border border-zinc-800/60 px-2 py-1.5 text-[11px]">
      <span className="font-mono text-zinc-300">{trade.symbol}</span>
      <span className={trade.valid ? " text-emerald-400" : " text-rose-400"}>
        {trade.valid ? " valid" : " invalid"}
      </span>
      {!trade.valid && trade.missingFields.length > 0 && (
        <p className="mt-0.5 text-zinc-500">
          Missing: {trade.missingFields.join(", ")}
        </p>
      )}
    </li>
  );
}

export default function EvidenceQualityPanel({
  quality,
  compact = false,
}: {
  quality: EvidenceQualitySnapshot | null | undefined;
  compact?: boolean;
}) {
  if (!quality) {
    return <p className="text-sm text-zinc-500">Evidence quality loading…</p>;
  }

  const invalidPreview = quality.trades.filter((t) => !t.valid).slice(0, compact ? 3 : 8);

  return (
    <div data-mvp="89" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={LEVEL_CLASS[quality.evidenceQualityLevel]}>
          {quality.evidenceQualityLevel}
        </span>
        <span className="text-zinc-400">
          {quality.validEvidenceCount} valid · {quality.invalidEvidenceCount} invalid
        </span>
        <span className="font-mono text-zinc-300">
          {quality.evidenceConfidence}% confidence
        </span>
      </div>

      <p className="text-xs text-zinc-400">
        Strategy review readiness:{" "}
        <span
          className={
            quality.readinessForStrategyReview ? "text-emerald-300" : "text-amber-300"
          }
        >
          {quality.readinessForStrategyReview ? "Ready" : "Not ready"}
        </span>
      </p>

      {quality.blockReason && (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {quality.blockReason}
        </p>
      )}

      {quality.missingFields.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Missing fields (invalid trades)
          </p>
          <ul className="mt-1 space-y-0.5">
            {quality.missingFields.map((gap) => (
              <FieldGapRow key={gap.field} gap={gap} />
            ))}
          </ul>
        </div>
      )}

      {!compact && invalidPreview.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Invalid completed trades
          </p>
          <ul className="mt-1 space-y-1">{invalidPreview.map((t) => (
            <TradeRow key={t.tradeId} trade={t} />
          ))}</ul>
        </div>
      )}

      <p className="text-[10px] text-zinc-600">
        Incomplete trades are excluded from performance trust. Strategy health review
        requires evidence quality GOOD with zero invalid trades.
      </p>
    </div>
  );
}

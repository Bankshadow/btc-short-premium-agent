import type { CombinationReadResult, VerdictOutput } from "@/lib/types/market";

interface VerdictCardProps {
  verdict: VerdictOutput;
  combinationRead: CombinationReadResult;
  showCombinationRead?: boolean;
}

const verdictStyles: Record<VerdictOutput["recommendation"], string> = {
  trade:
    "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50",
  wait: "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50",
  skip: "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/50",
};

const verdictTextStyles: Record<VerdictOutput["recommendation"], string> = {
  trade: "text-emerald-700 dark:text-emerald-300",
  wait: "text-amber-700 dark:text-amber-300",
  skip: "text-red-700 dark:text-red-300",
};

export default function VerdictCard({
  verdict,
  combinationRead,
  showCombinationRead = true,
}: VerdictCardProps) {
  const label = verdict.recommendation.toUpperCase();

  return (
    <section
      className={`rounded-xl border-2 p-8 shadow-sm ${verdictStyles[verdict.recommendation]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Verdict
      </p>
      <p
        className={`mt-2 text-5xl font-bold tracking-tight sm:text-6xl ${verdictTextStyles[verdict.recommendation]}`}
      >
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {verdict.confidence}% confidence
      </p>
      <p className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        {verdict.summary}
      </p>

      {showCombinationRead && (
        <div className="mt-5 rounded-lg border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-700 dark:bg-black/20">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {combinationRead.label}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {combinationRead.actionHint}
          </p>
          {combinationRead.dataStatus === "partial_data" && (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              PARTIAL_DATA — missing:{" "}
              {combinationRead.missingFields.join(", ")}
            </p>
          )}
        </div>
      )}

      {verdict.risks.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {verdict.risks.map((risk) => (
            <li key={risk} className="flex gap-2">
              <span className="text-zinc-400">•</span>
              {risk}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

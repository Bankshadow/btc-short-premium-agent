import type { CombinationReadResult } from "@/lib/types/market";

interface CombinationReadPanelProps {
  combinationRead: CombinationReadResult;
}

const regimeStyles: Record<
  CombinationReadResult["liquidationRegime"],
  string
> = {
  safe: "text-emerald-700 dark:text-emerald-300",
  borderline: "text-amber-700 dark:text-amber-300",
  caution: "text-amber-700 dark:text-amber-300",
  cascade: "text-red-700 dark:text-red-300",
  unknown: "text-zinc-600 dark:text-zinc-400",
};

export default function CombinationReadPanel({
  combinationRead,
}: CombinationReadPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Derivatives Context
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Combination Read
        </h2>
      </header>

      <div className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            {combinationRead.label}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {combinationRead.actionHint}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Pattern</dt>
            <dd className="mt-0.5 font-medium uppercase text-zinc-900 dark:text-zinc-50">
              {combinationRead.pattern.replace(/_/g, " ")}
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Liquidation regime</dt>
            <dd
              className={`mt-0.5 font-medium uppercase ${regimeStyles[combinationRead.liquidationRegime]}`}
            >
              {combinationRead.liquidationRegime}
            </dd>
          </div>
        </dl>

        {combinationRead.dataStatus === "partial_data" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            PARTIAL_DATA — missing: {combinationRead.missingFields.join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}

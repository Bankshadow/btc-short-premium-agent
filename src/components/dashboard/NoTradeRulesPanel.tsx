import type { NoTradeRuleResult } from "@/lib/types/market";

interface NoTradeRulesPanelProps {
  rules: NoTradeRuleResult[];
}

export default function NoTradeRulesPanel({ rules }: NoTradeRulesPanelProps) {
  const triggered = rules.filter((r) => r.triggered);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Hard Stops
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          No-Trade Rules
        </h2>
      </header>

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              rule.triggered
                ? rule.severity === "hard"
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                : "border-zinc-100 dark:border-zinc-800"
            }`}
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {rule.name}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">{rule.message}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                rule.triggered
                  ? rule.severity === "hard"
                    ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {rule.triggered
                ? rule.severity === "hard"
                  ? "TRIGGERED"
                  : "CAUTION"
                : "CLEAR"}
            </span>
          </li>
        ))}
      </ul>

      {triggered.length === 0 && (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
          All no-trade rules clear.
        </p>
      )}
    </section>
  );
}

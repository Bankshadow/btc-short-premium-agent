import type {
  ActionPlan,
  NoTradeRuleResult,
  VerdictOutput,
} from "@/lib/types/market";
import { formatUsd } from "./utils";

interface ActionPlanCardProps {
  verdict: VerdictOutput;
  actionPlan: ActionPlan;
  noTradeRules: NoTradeRuleResult[];
}

export default function ActionPlanCard({
  verdict,
  actionPlan,
  noTradeRules,
}: ActionPlanCardProps) {
  const isTrade = verdict.recommendation === "trade";
  const candidate = verdict.candidate;

  const triggeredHard = noTradeRules.filter(
    (r) => r.triggered && r.severity === "hard",
  );
  const triggeredSoft = noTradeRules.filter(
    (r) => r.triggered && r.severity === "soft",
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Hypothetical Plan
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Action Plan
        </h2>
      </header>

      {isTrade && candidate ? (
        <dl className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">Strategy</dt>
            <dd className="font-semibold uppercase text-zinc-900 dark:text-zinc-50">
              {actionPlan.action.replace("_", " ")}
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">Strike</dt>
            <dd>{formatUsd(candidate.strike)}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">Entry</dt>
            <dd>{actionPlan.entryNotes}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">Size</dt>
            <dd>
              {actionPlan.suggestedSizePct}% of portfolio
              {verdict.caution ? " (reduced — caution zone)" : ""}
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">SL</dt>
            <dd>
              Index Price {formatUsd(actionPlan.slIndexPrice)} — never Mark
              Price
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">TP</dt>
            <dd>
              {actionPlan.targetPremiumCapturePct}% max premium capture
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="font-medium text-zinc-500">Forced exit</dt>
            <dd>
              {actionPlan.pinExitTimeTh} TH (settlement{" "}
              {actionPlan.settlementTimeTh} TH)
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {verdict.recommendation === "wait"
              ? "WAIT — resolve before trading"
              : "SKIP — do not open hypothetical position"}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">{verdict.summary}</p>

          {verdict.missingData.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
                Missing data
              </p>
              <ul className="mt-1 list-inside list-disc text-amber-900 dark:text-amber-200">
                {verdict.missingData.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {triggeredHard.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-xs font-semibold uppercase text-red-800 dark:text-red-300">
                Hard rules triggered
              </p>
              <ul className="mt-1 space-y-1 text-red-900 dark:text-red-200">
                {triggeredHard.map((r) => (
                  <li key={r.id}>{r.message}</li>
                ))}
              </ul>
            </div>
          )}

          {triggeredSoft.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
                Caution flags
              </p>
              <ul className="mt-1 space-y-1 text-amber-900 dark:text-amber-200">
                {triggeredSoft.map((r) => (
                  <li key={r.id}>{r.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

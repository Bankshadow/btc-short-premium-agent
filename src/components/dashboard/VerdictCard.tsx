import type {
  ActionPlan,
  CheckResult,
  CombinationReadResult,
  NoTradeRuleResult,
  VerdictOutput,
} from "@/lib/types/market";
import { formatUsd } from "./utils";
import {
  collectTopReasons,
  formatStrategyLabel,
  resolveActionSummary,
  resolveConfidenceLevel,
  resolveRecheckGuidance,
  type ConfidenceLevel,
} from "./verdict-display";

interface VerdictCardProps {
  verdict: VerdictOutput;
  actionPlan: ActionPlan;
  checks: CheckResult[];
  noTradeRules: NoTradeRuleResult[];
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

const confidenceStyles: Record<ConfidenceLevel, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  MEDIUM:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  LOW: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function VerdictCard({
  verdict,
  actionPlan,
  checks,
  noTradeRules,
  combinationRead,
  showCombinationRead = false,
}: VerdictCardProps) {
  const { recommendation } = verdict;
  const isTrade =
    recommendation === "trade" && actionPlan.action !== "no_trade";
  const candidate = verdict.candidate;

  const confidenceLevel = resolveConfidenceLevel(
    verdict.confidence,
    recommendation,
  );
  const topReasons = collectTopReasons(
    verdict,
    checks,
    noTradeRules,
    combinationRead,
  );
  const actionSummary = resolveActionSummary(verdict, actionPlan);
  const recheckGuidance = resolveRecheckGuidance(verdict, noTradeRules);

  return (
    <section
      className={`rounded-xl border-2 p-8 shadow-sm ${verdictStyles[recommendation]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Final Verdict
          </p>
          <p
            className={`mt-1 text-5xl font-bold tracking-tight sm:text-6xl ${verdictTextStyles[recommendation]}`}
          >
            {recommendation.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Confidence
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold ${confidenceStyles[confidenceLevel]}`}
          >
            {confidenceLevel}
          </span>
          <p className="mt-1 text-[11px] text-zinc-500">
            {verdict.confidence}/100 score
          </p>
        </div>
      </div>

      {topReasons.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Top {topReasons.length} reason{topReasons.length > 1 ? "s" : ""}
          </p>
          <ol className="mt-2 space-y-2">
            {topReasons.map((reason, index) => (
              <li
                key={`${index}-${reason.slice(0, 40)}`}
                className="flex gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900/10 text-xs font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                  {index + 1}
                </span>
                {reason}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-700 dark:bg-black/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Action summary
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {actionSummary}
        </p>
      </div>

      {recommendation === "skip" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            No order recommended
          </p>
          <div className="rounded-lg border border-red-200/80 bg-red-50/80 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              When to recheck
            </p>
            <p className="mt-1 text-sm text-red-900 dark:text-red-100">
              {recheckGuidance}
            </p>
          </div>
        </div>
      )}

      {recommendation === "wait" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            No order yet — resolve open items first
          </p>
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              When to recheck
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
              {recheckGuidance}
            </p>
          </div>
        </div>
      )}

      {isTrade && candidate && (
        <div className="mt-6 rounded-lg border border-emerald-300/80 bg-white/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Hypothetical order ticket
          </p>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">Strategy</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                {formatStrategyLabel(actionPlan.action)}
              </dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">Strike</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-50">
                {formatUsd(candidate.strike)}
              </dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">Entry premium</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                Bid {formatUsd(candidate.bid)} / Mark{" "}
                {formatUsd(candidate.markPrice)}
                {verdict.caution ? " · reduced size" : ""}
              </dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">Size</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {actionPlan.suggestedSizePct}% of portfolio
              </dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">SL</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                Index Price {formatUsd(actionPlan.slIndexPrice)} — never Mark
                Price
              </dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-medium text-zinc-500">Forced exit</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {actionPlan.pinExitTimeTh} TH (settlement{" "}
                {actionPlan.settlementTimeTh} TH)
              </dd>
            </div>
          </dl>
        </div>
      )}

      {showCombinationRead && (
        <div className="mt-5 rounded-lg border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-700 dark:bg-black/20">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {combinationRead.label}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {combinationRead.actionHint}
          </p>
        </div>
      )}
    </section>
  );
}

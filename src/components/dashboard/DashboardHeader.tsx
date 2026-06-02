import { formatTimestamp } from "./utils";

interface DashboardHeaderProps {
  analyzedAt: string;
  marketTimestamp: string;
}

export default function DashboardHeader({
  analyzedAt,
  marketTimestamp,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Analysis-only mode
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            BTC Short Premium Agent
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Playbook v2.0 · Co-pilot desk · No auto-trading
          </p>
        </div>
        <dl className="text-right text-xs text-zinc-500">
          <div>
            <dt className="inline after:content-[':']">Analysis run</dt>{" "}
            <dd className="inline font-medium text-zinc-700 dark:text-zinc-300">
              {formatTimestamp(analyzedAt)}
            </dd>
          </div>
          <div className="mt-1">
            <dt className="inline after:content-[':']">Market data</dt>{" "}
            <dd className="inline font-medium text-zinc-700 dark:text-zinc-300">
              {formatTimestamp(marketTimestamp)}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

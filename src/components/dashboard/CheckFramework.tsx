import type { CheckResult } from "@/lib/types/market";
import {
  CHECK_LABELS,
  filterCoreChecks,
  statusStyles,
  toDisplayStatus,
} from "./utils";

interface CheckFrameworkProps {
  checks: CheckResult[];
}

export default function CheckFramework({ checks }: CheckFrameworkProps) {
  const coreChecks = filterCoreChecks(checks);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Framework
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          8-Check Framework
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
              <th className="pb-3 pr-4 font-medium">Check</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {coreChecks.map((check) => {
              const displayStatus = toDisplayStatus(check.status);
              const label =
                CHECK_LABELS[check.id as keyof typeof CHECK_LABELS] ??
                check.name;

              return (
                <tr
                  key={check.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-50">
                    {label}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyles(displayStatus)}`}
                    >
                      {displayStatus}
                    </span>
                  </td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-400">
                    {check.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

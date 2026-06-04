"use client";

import type { DraftRule, DraftRuleStatus } from "@/lib/journal/draft-rules";
import { updateDraftRuleStatus } from "@/lib/journal/draft-rules";

interface DraftRulesPanelProps {
  rules: DraftRule[];
  onRefresh: () => void;
}

const statusStyle: Record<DraftRuleStatus, string> = {
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function DraftRulesPanel({
  rules,
  onRefresh,
}: DraftRulesPanelProps) {
  const handleStatus = (id: string, status: DraftRuleStatus) => {
    updateDraftRuleStatus(id, status);
    onRefresh();
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Draft Rule Proposals
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Generated from reflections only. Draft rules are never used in live
        Analyze until you manually approve — approval is for your playbook, not
        auto execution.
      </p>

      {rules.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          No draft rules yet. Resolve a decision with reflection to propose one.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{rule.title}</p>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusStyle[rule.status]}`}
                >
                  {rule.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {rule.description}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                From log {rule.sourceEntryId.slice(0, 12)}…
                {rule.fromReflection ? " · reflection" : ""}
              </p>
              {rule.status === "draft" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatus(rule.id, "approved")}
                    className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    Approve (manual playbook)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(rule.id, "rejected")}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

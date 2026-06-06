"use client";

import Link from "next/link";

type Props = {
  title: string;
  missing: string;
  why: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
};

export default function DeskEmptyState({
  title,
  missing,
  why,
  actionLabel,
  actionHref,
  onAction,
}: Props) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-5 py-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">
        {title}
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-200">{missing}</p>
      <p className="mt-1 text-xs text-zinc-500">{why}</p>
      {(actionHref || onAction) && (
        <div className="mt-4">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-block rounded-lg bg-amber-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-600"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="rounded-lg bg-amber-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-600"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

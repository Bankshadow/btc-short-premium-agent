"use client";

import type { AdvancedModuleStatus } from "@/lib/advanced-modules/types";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function roleLabel(role: AdvancedModuleStatus["role"]): string {
  switch (role) {
    case "analysis_input":
      return "Analysis input";
    case "advisory":
      return "Advisory";
    case "metadata":
      return "Metadata only";
    default:
      return role;
  }
}

export default function AdvancedModuleEngineBanner({
  status,
  loading,
  error,
}: {
  status: AdvancedModuleStatus | null;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <section className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 text-sm text-zinc-500">
        Loading central engine linkage…
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-3 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-200/90">
        {error}
      </section>
    );
  }

  if (!status) return null;

  return (
    <section className="mt-3 rounded-xl border border-violet-900/35 bg-violet-950/15 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {status.usedByCentralEngine ? (
          <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200 ring-1 ring-violet-500/30">
            Used by Central Engine
          </span>
        ) : (
          <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 ring-1 ring-zinc-700/50">
            Not read by engine
          </span>
        )}
        <span className="rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400 ring-1 ring-zinc-800">
          {roleLabel(status.role)}
        </span>
        {status.advisoryOnly && (
          <span className="rounded-md bg-amber-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-800/40">
            Advisory
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-300">{status.description}</p>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Engine reads</dt>
          <dd className="mt-0.5 text-zinc-200">{status.engineReads ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Context field</dt>
          <dd className="mt-0.5 font-mono text-zinc-300">{status.contextField ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Last updated</dt>
          <dd className="mt-0.5 text-zinc-200">{formatWhen(status.lastUpdatedAt)}</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
            Impact on latest analysis
          </dt>
          <dd className="mt-0.5 text-zinc-200">{status.analysisImpact ?? "—"}</dd>
        </div>
      </dl>

      {status.relatedEvents.length > 0 && (
        <div className="mt-4 border-t border-violet-900/25 pt-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Related engine events
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            {status.relatedEvents.map((ev) => (
              <li key={ev.id} className="rounded border border-zinc-800/70 px-2 py-1.5 text-zinc-400">
                <span className="text-violet-400/80">{ev.type.replace(/_/g, " ")}</span>
                <span className="mx-1 text-zinc-600">·</span>
                <span className="text-zinc-500">{formatWhen(ev.timestamp)}</span>
                <p className="mt-0.5 text-zinc-300">{ev.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

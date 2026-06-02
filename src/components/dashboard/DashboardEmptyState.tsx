export default function DashboardEmptyState() {
  return (
    <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Analysis-only mode
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Ready for live analysis
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">
        No dashboard data loaded yet. Configure Macro Event and Manual Overrides
        if needed, then click{" "}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          Analyze Now
        </span>{" "}
        to fetch live Bybit public data and run the decision engine.
      </p>
      <p className="mt-4 text-xs text-zinc-500">
        Hypothetical analysis only — no real orders are placed.
      </p>
    </section>
  );
}

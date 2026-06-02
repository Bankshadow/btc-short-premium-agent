export default function DashboardLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-pulse"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading analysis"
    >
      <div className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-72 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

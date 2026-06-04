export default function DashboardLoadingSkeleton() {
  return (
    <div
      className="desk-panel relative overflow-hidden p-8"
      aria-live="polite"
      aria-busy="true"
      aria-label="Desk session in progress"
    >
      <div className="desk-scan-line absolute inset-0 opacity-50" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
        <p className="text-sm font-medium text-amber-200/90">
          Trading desk in session
        </p>
        <p className="max-w-md text-xs text-zinc-500">
          Agents are fetching Bybit data and running committee — no button required
        </p>
      </div>
    </div>
  );
}

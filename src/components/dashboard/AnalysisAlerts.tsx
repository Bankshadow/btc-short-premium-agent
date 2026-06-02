import type { AnalyzeApiResponse, DataSourceError } from "@/lib/types/market";

interface AnalysisAlertsProps {
  fetchError: string | null;
  sourceErrors: DataSourceError[];
}

export default function AnalysisAlerts({
  fetchError,
  sourceErrors,
}: AnalysisAlertsProps) {
  if (!fetchError && sourceErrors.length === 0) return null;

  return (
    <div className="space-y-3">
      {fetchError && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/50"
        >
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Analysis failed
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {fetchError}
          </p>
        </div>
      )}

      {sourceErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Data source issues ({sourceErrors.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {sourceErrors.map((item) => (
              <li
                key={`${item.source}-${item.message}`}
                className="text-sm text-amber-900 dark:text-amber-100"
              >
                <span className="font-medium">{item.source}:</span>{" "}
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

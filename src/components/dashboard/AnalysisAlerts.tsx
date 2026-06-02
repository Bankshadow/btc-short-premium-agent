import type { DataSourceError } from "@/lib/types/market";

interface AnalysisAlertsProps {
  fetchError: string | null;
  sourceErrors: DataSourceError[];
}

const DEMO_MODE_PATTERN = /demo mode|mock data only|homepage uses mock/i;

function filterSourceErrors(errors: DataSourceError[]): DataSourceError[] {
  return errors.filter(
    (item) => !DEMO_MODE_PATTERN.test(`${item.source} ${item.message}`),
  );
}

export default function AnalysisAlerts({
  fetchError,
  sourceErrors,
}: AnalysisAlertsProps) {
  const issues = filterSourceErrors(sourceErrors);

  if (!fetchError && issues.length === 0) return null;

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

      {issues.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Data source issues ({issues.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {issues.map((item) => (
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

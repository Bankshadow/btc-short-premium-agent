"use client";

import { useCallback, useEffect, useState } from "react";

interface AutomationStatus {
  testEnabled: boolean;
  cronSecretConfigured: boolean;
  telegramConfigured: boolean;
}

interface CronTestResult {
  timestamp?: string;
  verdict?: string;
  confidenceLevel?: string;
  telegramSent?: boolean;
  supabaseSaved?: boolean;
  supabaseRunId?: string;
  warnings?: string[];
  actionSummary?: string;
  error?: string;
  test?: boolean;
}

export default function TestAutomationPanel() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CronTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/automation-status")
      .then((res) => res.json())
      .then((data: AutomationStatus) => setStatus(data))
      .catch(() =>
        setStatus({
          testEnabled: false,
          cronSecretConfigured: false,
          telegramConfigured: false,
        }),
      );
  }, []);

  const handleTestTelegram = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/cron/analyze?test=1", {
        method: "POST",
        headers: { "X-Test-Mode": "true" },
      });

      const payload = (await response.json()) as CronTestResult;

      if (!response.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      setResult(payload);

      if (payload.warnings?.length) {
        setError(payload.warnings.join(" "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test automation failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const testEnabled = status?.testEnabled ?? false;

  return (
    <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Admin
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Test Automation
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Runs the cron analysis pipeline and sends a Telegram alert. Analysis
          only — no orders placed.
        </p>
      </header>

      {status && !testEnabled && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {!status.cronSecretConfigured
            ? "Set CRON_SECRET in .env.local to enable test automation locally."
            : "Test automation is disabled in this environment. Use local dev, or set ALLOW_TEST_AUTOMATION=true on Vercel."}
          {!status.telegramConfigured && status.cronSecretConfigured && (
            <span className="mt-1 block">
              Also configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for
              alerts.
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleTestTelegram}
        disabled={loading || !testEnabled}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100"
            aria-hidden
          />
        )}
        {loading ? "Running cron test…" : "Test Telegram Alert"}
      </button>

      {result && !error && result.telegramSent && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <p className="font-semibold">Telegram alert sent successfully</p>
          <p className="mt-1">
            Verdict: {result.verdict?.toUpperCase()} · Confidence:{" "}
            {result.confidenceLevel}
          </p>
          {result.actionSummary && (
            <p className="mt-1 text-emerald-800 dark:text-emerald-200">
              {result.actionSummary}
            </p>
          )}
          {result.supabaseSaved && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              Saved to Supabase journal (run {result.supabaseRunId?.slice(0, 8)}
              …)
            </p>
          )}
        </div>
      )}

      {result && !error && !result.telegramSent && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="font-semibold">Analysis completed — Telegram not sent</p>
          {result.warnings?.map((warning) => (
            <p key={warning} className="mt-1">
              {warning}
            </p>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
        >
          <p className="font-semibold">Test failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
    </section>
  );
}

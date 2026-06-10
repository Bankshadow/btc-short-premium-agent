"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";

export function useApi<T>(url: string, refreshKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<T>(url);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { data, error, loading, reload };
}

export function LoadingOrError({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return <p className="empty-state">Loading…</p>;
  }
  if (error) {
    return (
      <div className="error-box">
        {error}
        {onRetry ? (
          <button type="button" className="btn ml-3 mt-2" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "safe" | "blocked" | "wait";
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

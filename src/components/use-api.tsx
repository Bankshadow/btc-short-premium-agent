"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { unwrapProjectionData } from "@/lib/core/projection-api-response";
import { PROJECTION_FETCH_TIMEOUT_MS } from "@/lib/core/projection-defaults";

function normalizeApiPayload<T>(json: T, fallback?: T): T {
  const data = unwrapProjectionData<T>(json);
  if (data === null) return fallback ?? (json as T);
  return data;
}

export function useApi<T>(
  url: string,
  refreshKey = 0,
  options?: { enabled?: boolean; fallback?: T; timeoutMs?: number },
) {
  const enabled = options?.enabled !== false && Boolean(url);
  const hasFallback = options?.fallback !== undefined;
  const fallbackRef = useRef(options?.fallback);
  fallbackRef.current = options?.fallback;
  const timeoutMs = options?.timeoutMs ?? PROJECTION_FETCH_TIMEOUT_MS;
  const [data, setData] = useState<T | null>(options?.fallback ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(enabled && !hasFallback);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const fallback = fallbackRef.current;
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      setData(fallback ?? null);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    setRefreshing(true);
    setLoading(!hasFallback);
    setError(null);
    try {
      const json = normalizeApiPayload(await fetchJson<T>(url, { timeoutMs }), fallback);
      if (id !== requestId.current) return;
      setData(json);
    } catch (err) {
      if (id !== requestId.current) return;
      const message = err instanceof Error ? err.message : "Load failed";
      setError(message);
      if (fallback !== undefined) setData(fallback);
      else setData(null);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, hasFallback, timeoutMs, url]);

  useEffect(() => {
    const fallback = fallbackRef.current;
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      setData(fallback ?? null);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    setRefreshing(true);
    setLoading(!hasFallback);
    setError(null);

    const hardStop = setTimeout(() => {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        if (fallback !== undefined) setData(fallback);
      }
    }, timeoutMs + 250);

    void (async () => {
      try {
        const json = normalizeApiPayload(await fetchJson<T>(url, { timeoutMs }), fallback);
        if (id !== requestId.current) return;
        setData(json);
      } catch (err) {
        if (id !== requestId.current) return;
        const message = err instanceof Error ? err.message : "Load failed";
        setError(message);
        if (fallback !== undefined) setData(fallback);
        else setData(null);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      requestId.current += 1;
      clearTimeout(hardStop);
    };
  }, [enabled, hasFallback, timeoutMs, url, refreshKey]);

  return { data, error, loading, refreshing, reload };
}

export function LoadingOrError({
  loading,
  error,
  onRetry,
  blocking = true,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** When false, never block page render — use ProjectionWarningPanel instead. */
  blocking?: boolean;
}) {
  if (!blocking) return null;
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

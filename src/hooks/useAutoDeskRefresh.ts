"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const DESK_REFRESH_OPTIONS = [
  { label: "1 min", ms: 60_000 },
  { label: "3 min", ms: 180_000 },
  { label: "5 min", ms: 300_000 },
] as const;

const DEFAULT_INTERVAL_MS = DESK_REFRESH_OPTIONS[1].ms;

export function useAutoDeskRefresh(
  run: () => void | Promise<void>,
  options?: {
    enabled?: boolean;
    intervalMs?: number;
    /** Wait for localStorage macro/overrides before first run */
    ready?: boolean;
  },
) {
  const enabled = options?.enabled ?? true;
  const ready = options?.ready ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    Math.floor(intervalMs / 1000),
  );
  const runRef = useRef(run);
  const bootedRef = useRef(false);
  runRef.current = run;

  useEffect(() => {
    setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
  }, [intervalMs]);

  const trigger = useCallback(() => {
    void runRef.current();
    setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
  }, [intervalMs]);

  useEffect(() => {
    if (!ready || bootedRef.current) return;
    bootedRef.current = true;
    const boot = window.setTimeout(() => void runRef.current(), 300);
    return () => clearTimeout(boot);
  }, [ready]);

  useEffect(() => {
    if (!enabled || !ready) return;

    const tick = window.setInterval(() => {
      setSecondsUntilRefresh((s) => {
        if (s <= 1) {
          void runRef.current();
          return Math.floor(intervalMs / 1000);
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [enabled, intervalMs, ready]);

  return { secondsUntilRefresh, trigger, intervalMs };
}

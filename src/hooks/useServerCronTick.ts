"use client";

import { useEffect, useRef } from "react";

/**
 * Polls /api/cron/tick while the page is open so sub-5-minute intervals work
 * without waiting for GitHub Actions (5 min minimum).
 */
export function useServerCronTick(input: {
  enabled: boolean;
  paused: boolean;
  intervalMinutes: number;
}): void {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (!input.enabled || input.paused) return;

    const pollMs = Math.max(30_000, Math.min(input.intervalMinutes * 60_000, 60_000));

    const tick = () => {
      void fetch("/api/automation/cron-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      }).catch(() => undefined);
    };

    tick();
    tickRef.current = setInterval(tick, pollMs);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [input.enabled, input.paused, input.intervalMinutes]);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineEvent } from "@/lib/engine-event-bus/types";
import { DASHBOARD_ALERT_EVENT_TYPES } from "@/lib/engine-event-bus/types";

export interface EngineEventsPayload {
  ok: boolean;
  events: EngineEvent[];
  total: number;
  liveTradingLocked: true;
  error?: string;
}

export interface UseEngineEventsOptions {
  pollMs?: number;
  meaningfulOnly?: boolean;
  limit?: number;
  useSse?: boolean;
  onImportantEvent?: (event: EngineEvent) => void;
}

export function useEngineEvents(options: UseEngineEventsOptions = {}) {
  const {
    pollMs = 5000,
    meaningfulOnly = false,
    limit = 50,
    useSse = true,
    onImportantEvent,
  } = options;

  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);
  const onImportantRef = useRef(onImportantEvent);
  onImportantRef.current = onImportantEvent;

  const applyPayload = useCallback((json: EngineEventsPayload) => {
    if (!json.ok) return;
    const top = json.events[0];
    if (
      top &&
      top.id !== lastSeenIdRef.current &&
      lastSeenIdRef.current !== null &&
      DASHBOARD_ALERT_EVENT_TYPES.has(top.type)
    ) {
      onImportantRef.current?.(top);
    }
    if (top) lastSeenIdRef.current = top.id;
    setEvents(json.events);
    setTotal(json.total);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        ...(meaningfulOnly ? { meaningful: "1" } : {}),
      });
      const res = await fetch(`/api/analysis/events?${params}`, { cache: "no-store" });
      const json = (await res.json()) as EngineEventsPayload & { error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Engine events failed");
      }
      applyPayload(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Engine events failed");
    } finally {
      setBusy(false);
    }
  }, [applyPayload, limit, meaningfulOnly]);

  useEffect(() => {
    void refresh();

    if (useSse && typeof EventSource !== "undefined") {
      const params = meaningfulOnly ? "?meaningful=1" : "";
      const es = new EventSource(`/api/analysis/events/stream${params}`);
      es.onmessage = (msg) => {
        try {
          const json = JSON.parse(msg.data) as EngineEventsPayload & { changed?: boolean };
          if (json.ok) applyPayload(json);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es.close();
      };
      return () => es.close();
    }

    if (pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [applyPayload, meaningfulOnly, pollMs, refresh, useSse]);

  const meaningful = events.filter((e) => e.meaningful);

  return {
    events,
    meaningful,
    total,
    busy,
    error,
    refresh,
    latest: events[0] ?? null,
  };
}

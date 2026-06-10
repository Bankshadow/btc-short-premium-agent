"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisUiView } from "@/lib/analysis-engine/analysis-ui-adapter";
import type { CentralAnalysisState } from "@/lib/analysis-engine/analysis-state";
import type { EngineEvent } from "@/lib/engine-event-bus/types";

export interface AnalysisStatePayload {
  ok: boolean;
  state: CentralAnalysisState;
  ui: AnalysisUiView;
  events: EngineEvent[];
  eventsTotal?: number;
  liveTradingLocked: true;
  error?: string;
}

export function useAnalysisState(pollMs = 8000) {
  const [data, setData] = useState<AnalysisStatePayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (fresh = false) => {
    setBusy(true);
    try {
      const url = fresh ? "/api/analysis/state?fresh=1" : "/api/analysis/state";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as AnalysisStatePayload & { error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Analysis state failed");
      }
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis state failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    let es: EventSource | null = null;
    if (typeof EventSource !== "undefined") {
      es = new EventSource("/api/analysis/events/stream");
      es.onmessage = () => {
        void refresh();
      };
    }

    const id =
      pollMs > 0 ? window.setInterval(() => void refresh(), pollMs) : undefined;

    return () => {
      es?.close();
      if (id) window.clearInterval(id);
    };
  }, [pollMs, refresh]);

  return {
    ui: data?.ui ?? null,
    state: data?.state ?? null,
    events: data?.events ?? [],
    eventsTotal: data?.eventsTotal ?? 0,
    busy,
    error,
    refresh,
  };
}

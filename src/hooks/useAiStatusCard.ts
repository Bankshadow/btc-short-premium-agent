"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiStatusCardState } from "@/lib/ai-status/types";

const DEFAULT_CARD: AiStatusCardState = {
  updatedAt: new Date().toISOString(),
  currentTask: "Connecting to AI desk…",
  currentStep: "Initializing",
  progressPct: 0,
  permissionNeeded: false,
  permissionReason: null,
  estimatedNextAction: "Loading status",
  recentToolActions: [],
  isActive: false,
  runId: null,
  liveLocked: true,
  loopBlocker: {
    active: false,
    reason: null,
    riskLevel: null,
    actionDiversityPct: null,
    successRatePct: null,
    selfCheckSummary: null,
  },
  memorySummary: null,
  committeeSummary: null,
};

export function useAiStatusCard(input?: {
  pollMs?: number;
  useSse?: boolean;
  enabled?: boolean;
}) {
  const pollMs = input?.pollMs ?? 3000;
  const enabled = input?.enabled !== false;
  const [card, setCard] = useState<AiStatusCardState>(DEFAULT_CARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ai-status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Status failed");
      setCard(json.card as AiStatusCardState);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status failed");
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (input?.useSse && typeof EventSource !== "undefined") {
      const es = new EventSource("/api/ai-status/stream");
      esRef.current = es;
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { ok: boolean; card?: AiStatusCardState };
          if (data.ok && data.card) setCard(data.card);
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        es.close();
        esRef.current = null;
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    }

    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [enabled, input?.useSse, pollMs, refresh]);

  return { card, busy, error, refresh };
}

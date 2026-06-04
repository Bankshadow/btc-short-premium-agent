"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  appendDecisionLogFromAnalysis,
  loadDecisionLog,
  resolveDecisionOutcome,
  type DecisionLogEntry,
  type ResolveOutcomeInput,
} from "@/lib/journal/decision-log";
import { buildAgentScoreboard, type DeskScoreboard } from "@/lib/journal/agent-scoreboard";
import { loadDraftRules, type DraftRule } from "@/lib/journal/draft-rules";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useDecisionLog() {
  const [entries, setEntries] = useState<DecisionLogEntry[]>([]);
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setEntries(loadDecisionLog());
    setDraftRules(loadDraftRules());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const scoreboard: DeskScoreboard = useMemo(
    () => buildAgentScoreboard(entries),
    [entries],
  );

  const saveFromAnalysis = useCallback(
    (data: AnalyzeApiResponse) => {
      const next = appendDecisionLogFromAnalysis(data);
      setEntries(next);
      return next;
    },
    [],
  );

  const resolveOutcome = useCallback(
    (id: string, input: ResolveOutcomeInput) => {
      const result = resolveDecisionOutcome(id, input);
      refresh();
      return result;
    },
    [refresh],
  );

  return {
    entries,
    draftRules,
    scoreboard,
    saveFromAnalysis,
    resolveOutcome,
    refresh,
    hydrated,
  };
}

export const useAnalysisJournal = useDecisionLog;

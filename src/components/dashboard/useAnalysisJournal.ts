"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  appendAnalysisFromResponse,
  loadAnalysisJournal,
  type AnalysisJournalEntry,
} from "@/lib/journal/analysis-journal";
import { useCallback, useEffect, useState } from "react";

export function useAnalysisJournal() {
  const [entries, setEntries] = useState<AnalysisJournalEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(loadAnalysisJournal());
    setHydrated(true);
  }, []);

  const saveFromAnalysis = useCallback((data: AnalyzeApiResponse) => {
    const next = appendAnalysisFromResponse(data);
    setEntries(next);
    return next;
  }, []);

  return { entries, saveFromAnalysis, hydrated };
}

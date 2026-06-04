/** @deprecated Use `@/lib/journal/decision-log` */
export {
  DECISION_LOG_STORAGE_KEY as ANALYSIS_JOURNAL_STORAGE_KEY,
  DECISION_LOG_MAX_ENTRIES as JOURNAL_MAX_ENTRIES,
  type DecisionLogEntry as AnalysisJournalEntry,
  buildDecisionLogEntry as buildAnalysisJournalEntry,
  loadDecisionLog as loadAnalysisJournal,
  saveDecisionLogEntry as saveAnalysisJournalEntry,
  appendDecisionLogFromAnalysis as appendAnalysisFromResponse,
} from "./decision-log";

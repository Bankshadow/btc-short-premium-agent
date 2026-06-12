export type TraceLinkKind =
  | "runId"
  | "decisionLogId"
  | "tradeId"
  | "previewId"
  | "positionId"
  | "closePreviewId";

export interface TraceStep {
  eventId: string;
  type: string;
  timestamp: string;
  summary: string;
  phase: string;
}

export interface TraceReport {
  linkKind: TraceLinkKind;
  linkId: string;
  steps: TraceStep[];
  lifecycleState: string | null;
  missingExpectedEvents: string[];
  invalidTransitions: string[];
  recommendation: string;
  liveLocked: true;
  evidenceValidation?: import("@/lib/evidence/evidence-types").EvidenceTradeValidation | null;
  evidenceMissingEvents?: string[];
  evidenceRejectedReasons?: string[];
  readinessImpact?: string | null;
}

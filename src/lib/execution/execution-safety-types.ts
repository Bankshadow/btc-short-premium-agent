export type BlockerSeverity = "WARNING" | "HARD_BLOCK";

export interface ExecutionBlocker {
  code: string;
  severity: BlockerSeverity;
  message: string;
  requiredAction: string;
}

export interface ExecutionWarning {
  code: string;
  message: string;
}

export interface ExecutionSafetyResult {
  allowed: boolean;
  blocked: boolean;
  requiresDoubleConfirm: boolean;
  blockers: ExecutionBlocker[];
  warnings: ExecutionWarning[];
  previewId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  environment: "TESTNET";
  reviewedAt: string;
  executionEnabled: boolean;
  message: string;
  doubleConfirmProvided?: boolean;
}

export type ExecutionSafetyStatus =
  | "no_preview"
  | "ready"
  | "blocked"
  | "expired"
  | "duplicate";

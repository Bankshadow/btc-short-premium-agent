export const LOOP_GUARD_SAFETY_NOTICE =
  "Loop guard never retries orders blindly, never duplicates testnet orders, and never bypasses double confirm.";

export type LoopGuardActionType =
  | "DESK_ANALYZE"
  | "BINANCE_PREVIEW"
  | "BINANCE_EXECUTE"
  | "BINANCE_MONITOR"
  | "API_CALL"
  | "OTHER";

export type LoopRiskLevel = "PRODUCTIVE" | "SUSPICIOUS" | "STUCK";

export interface LoopGuardActionRecord {
  id: string;
  actionType: LoopGuardActionType;
  actionKey: string;
  success: boolean;
  failed: boolean;
  apiErrorKey?: string | null;
  tradeCandidateKey?: string | null;
  previewFingerprint?: string | null;
  previewId?: string | null;
  marketContextHash?: string | null;
  timestamp: string;
  runId?: string | null;
  summary?: string | null;
}

export interface LoopGuardMetrics {
  windowMinutes: number;
  totalActions: number;
  uniqueActionKeys: number;
  actionDiversity: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  repeatedFailureCount: number;
  maxSameActionRepeats: number;
  maxSameCandidateRepeats: number;
  maxSameApiFailureRepeats: number;
  staleMarketContextCycles: number;
  duplicatePreviewAttempts: number;
  duplicateOrderAttempts: number;
  loopRiskLevel: LoopRiskLevel;
  reasons: string[];
}

export interface LoopGuardDecision {
  level: LoopRiskLevel;
  continue: boolean;
  requiresSelfCheck: boolean;
  requiresPermission: boolean;
  stopLoop: boolean;
  reason: string;
  reasons: string[];
  metrics: LoopGuardMetrics;
  selfCheckSummary?: string | null;
}

export interface LoopGuardBlocker {
  active: boolean;
  reason: string;
  stoppedAt: string | null;
  actionItemId: string | null;
  loopRiskLevel: LoopRiskLevel | null;
  metrics: LoopGuardMetrics | null;
}

export interface LoopGuardState {
  workspaceId: string;
  records: LoopGuardActionRecord[];
  blocker: LoopGuardBlocker;
  suspiciousPermissionGrantedUntil: string | null;
  lastSelfCheckAt: string | null;
  lastSelfCheckSummary: string | null;
  updatedAt: string;
}

export interface RecordLoopGuardActionInput {
  actionType: LoopGuardActionType;
  actionKey: string;
  success: boolean;
  failed?: boolean;
  apiErrorKey?: string | null;
  tradeCandidateKey?: string | null;
  previewFingerprint?: string | null;
  previewId?: string | null;
  marketContextHash?: string | null;
  runId?: string | null;
  summary?: string | null;
}

export interface HardSafetyCheckInput {
  previewId: string;
  symbol: string;
  side: string;
  doubleConfirm: boolean;
  blindRetry?: boolean;
  submittedPreviewIds?: string[];
  previewFingerprint?: string | null;
  recentPreviewFingerprints?: string[];
}

export interface HardSafetyCheckResult {
  allowed: boolean;
  reason: string;
  violation: "NONE" | "NO_DOUBLE_CONFIRM" | "DUPLICATE_ORDER" | "DUPLICATE_PREVIEW" | "BLIND_RETRY";
}

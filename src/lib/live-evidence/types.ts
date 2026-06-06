export type LiveEvidenceStatus = "PASS" | "WARNING" | "FAIL";

export type LiveEvidenceCategoryId =
  | "paper_results"
  | "testnet_results"
  | "execution_quality"
  | "risk_control"
  | "incident_history"
  | "alert_status"
  | "ledger_health"
  | "operator_approval_readiness"
  | "strategy_health"
  | "exchange_connectivity";

export interface LiveEvidenceCategoryResult {
  id: LiveEvidenceCategoryId;
  label: string;
  status: LiveEvidenceStatus;
  evidence: string[];
  missingItems: string[];
  recommendation: string;
}

export interface LiveEvidenceReport {
  generatedAt: string;
  categories: LiveEvidenceCategoryResult[];
  readinessScore: number;
  blockers: string[];
  nextRequiredActions: string[];
  hardBlockersTriggered: Array<{
    key:
      | "no_testnet_closed_trades"
      | "no_learning_records"
      | "unresolved_critical_incidents"
      | "alert_off"
      | "ledger_unhealthy"
      | "strategy_health_below_threshold"
      | "risk_replay_not_reviewed"
      | "no_double_confirm"
      | "live_endpoint_not_locked_correctly"
      | "execution_quality_degraded";
    message: string;
  }>;
  readyForMicroLivePilot: boolean;
  safety: {
    cannotEnableLive: true;
    recommendationOnly: true;
    separateApprovalRequired: true;
  };
}

export interface LiveEvidenceBuildInput {
  generatedAt?: string;
  thresholds?: {
    minStrategyHealthScore: number;
    minPaperSamples: number;
    minTestnetTrades: number;
  };
  paper: {
    sampleSize: number;
    winRate: number;
    averageR: number;
    totalPnl: number;
  };
  testnet: {
    closedTrades: number;
    learningRecords: number;
    learnedRecords: number;
    winRate: number;
    mismatches: number;
  };
  execution: {
    failedLiveTrades: number;
    criticalExecutionIncidents: number;
    warningExecutionIncidents: number;
    averageSlippageBps: number;
    rejectionRatePct: number;
    failedCloseRatePct: number;
    averageLatencyMs: number;
    duplicateSubmissionCount: number;
    retryCountTotal: number;
    gateStatus: "PASS" | "WARNING" | "FAIL";
    gateReasons: string[];
  };
  riskControl: {
    riskStatus: "SAFE" | "CAUTION" | "BLOCKED" | "EMERGENCY";
    blockNewTrades: boolean;
    triggeredLimits: string[];
    riskReplayReviewedAt: string | null;
  };
  incidents: {
    openCount: number;
    warningOpenCount: number;
    criticalOpenCount: number;
  };
  alerts: {
    anyChannelConfigured: boolean;
    recentDeliveryFailures: number;
    lastDeliveryAt: string | null;
  };
  ledger: {
    healthy: boolean;
    entryCount: number;
    brokenLinks: number;
    missingHashes: number;
    orphanTrades: number;
    issues: string[];
    lastSyncedAt: string | null;
  };
  operatorApproval: {
    doubleConfirmRequired: boolean;
    pendingApprovalActions: number;
  };
  strategyHealth: {
    healthScorePct: number;
    totalStrategies: number;
    healthyStrategies: number;
    reviewRequiredCount: number;
    pausedCount: number;
    candidateForLiveCount: number;
  };
  exchange: {
    configured: boolean;
    connected: boolean;
    network: string | null;
    error: string | null;
    clockSkewMs: number | null;
  };
  endpointLock: {
    lockedCorrectly: boolean;
    detail: string;
  };
}

export interface LiveEvidenceReportExport {
  markdown: string;
  text: string;
  json: LiveEvidenceReport;
}

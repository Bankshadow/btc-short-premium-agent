import type { IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/governance/governance-types";
import type { AutomationFailedJob, AutomationJob, AutomationRun } from "@/lib/automation-control-plane/types";
import type { PolicyDecisionRecord } from "@/lib/policy-engine/types";

export type HealthDimension =
  | "platform"
  | "trading"
  | "data"
  | "automation"
  | "risk"
  | "integration";

export type HealthLevel = "HEALTHY" | "DEGRADED" | "CRITICAL";

export type LiveTradingPosture = "SAFE" | "CAUTION" | "BLOCKED";

export interface HealthDimensionScore {
  dimension: HealthDimension;
  level: HealthLevel;
  score: number;
  summary: string;
  issues: string[];
}

export interface ApiHealthSignal {
  analyzeRouteOk: boolean;
  cronConfigured: boolean;
  lastCheckAt: string;
}

export interface ExchangeConnectivitySignal {
  configured: boolean;
  connected: boolean;
  network: string | null;
  error: string | null;
  clockSkewMs: number | null;
}

export interface DatabaseHealthSignal {
  configured: boolean;
  backend: string;
  liveExecutionBlocked: boolean;
  liveBlockReason: string | null;
  writeFailures: number;
}

export interface AutomationHealthSignal {
  paused: boolean;
  failedJobCount: number;
  consecutiveFailureTypes: string[];
  lastRunStatus: string | null;
  lastRunAt: string | null;
}

export interface AlertDeliverySignal {
  telegramConfigured: boolean;
  discordConfigured: boolean;
  deskWebhookConfigured: boolean;
  anyChannelConfigured: boolean;
  recentDeliveryFailures: number;
  lastDeliveryAt: string | null;
}

export interface MarketDataFreshnessSignal {
  btcPrice: number | null;
  dataTrustGrade: string | null;
  staleWarning: string | null;
  analysisLatencyMs: number | null;
  lastAnalysisAt: string | null;
}

export interface ObservabilitySignals {
  workspaceId: string;
  collectedAt: string;
  api: ApiHealthSignal;
  exchange: ExchangeConnectivitySignal;
  database: DatabaseHealthSignal;
  automation: AutomationHealthSignal;
  alerts: AlertDeliverySignal;
  marketData: MarketDataFreshnessSignal;
  errorRate1h: number;
  policyBlocks1h: number;
  liveBlockers: string[];
  failedJobs: AutomationFailedJob[];
  recentPolicyBlocks: PolicyDecisionRecord[];
}

export interface PlatformHealthReport {
  generatedAt: string;
  workspaceId: string;
  overallScore: number;
  overallLevel: HealthLevel;
  liveTradingPosture: LiveTradingPosture;
  dimensions: HealthDimensionScore[];
  signals: ObservabilitySignals;
  commandCenterShouldBlock: boolean;
  safetyNotices: string[];
}

export interface ObservabilityErrorRecord {
  errorId: string;
  workspaceId: string;
  source: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  occurredAt: string;
  linkedJobId?: string | null;
  linkedPolicyRecordId?: string | null;
  metadata?: Record<string, string>;
}

export interface ObservabilityUsageRecord {
  usageId: string;
  workspaceId: string;
  action: string;
  userRole: string;
  occurredAt: string;
}

export interface ObservabilityIncidentLink {
  jobId?: string | null;
  failedJobId?: string | null;
  errorId?: string | null;
  policyRecordId?: string | null;
  runId?: string | null;
}

export interface ObservabilityIncident {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  rootCause: string;
  correctiveAction: string;
  resolutionNote: string;
  autoCreated: boolean;
  links: ObservabilityIncidentLink;
}

export interface AdminJobsSnapshot {
  generatedAt: string;
  workspaceId: string;
  failedJobs: AutomationFailedJob[];
  recentRuns: AutomationRun[];
  activeJobs: AutomationJob[];
}

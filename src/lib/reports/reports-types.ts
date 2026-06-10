import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { ExecutionSafetyGateReport } from "./execution-safety-report";
import type { EngineHealthReport } from "@/lib/health/engine-health-types";
import type { StrategyHealthReport } from "@/lib/strategy/strategy-types";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import type { EvidenceTradeResult } from "@/lib/evidence/evidence-types";
import type { RealizedPnlRecord } from "@/lib/pnl/pnl-types";

import type { DailyBriefing } from "@/lib/briefing/briefing-types";
import type { AuditPack } from "@/lib/audit/audit-types";
import type { MicroLiveReadinessReport } from "@/lib/live-readiness/readiness-types";
import type { LiveSandboxStatus } from "@/lib/live-sandbox/live-sandbox-types";
import type { PortfolioRiskReport } from "@/lib/portfolio-risk/portfolio-risk-types";

export interface PortfolioRiskHistoryEntry {
  timestamp: string;
  status: string;
  issueCount: number;
  blocksExecution: boolean;
}

export interface ReportsSummary {
  generatedAt: string;
  sprint: string;
  liveLocked: true;
  executionEnabled: false;
  mission: MissionSnapshot;
  evidenceProgress: {
    valid: number;
    required: number;
    invalid: number;
    readinessStatus?: string;
    trades?: EvidenceTradeResult[];
  };
  pnlSummary: {
    count: number;
    wins: number;
    losses: number;
    breakeven: number;
    totalNetPnl: number;
    averagePnl: number;
    bestTrade: RealizedPnlRecord | null;
    worstTrade: RealizedPnlRecord | null;
  };
  learningSummary: {
    count: number;
    latestLessons: Array<{ tradeId: string; lesson: string; result: string }>;
    repeatedMistakes: string[];
    repeatedStrengths: string[];
  };
  learningCount: number;
  testnetConfigured: boolean;
  binanceStatus: BinanceStatusDiagnostics;
  riskPolicy: {
    liveLocked: true;
    testnetOnly: true;
    requireDoubleConfirm: true;
  };
  executionSafetyGate: ExecutionSafetyGateReport;
  executionStats: {
    executionCount: number;
    openTradesCount: number;
  };
  positionStats: {
    openPositionsCount: number;
    monitoredPositionsCount: number;
    closePreviewsCount: number;
    closePreviewBlockedCount: number;
    closedPositionsCount: number;
    reconciliationStatus: string;
    latestCloseSafetyStatus: "NOT_REVIEWED" | "ALLOWED" | "BLOCKED";
    latestCloseReviewedAt: string | null;
    latestClosePreviewId: string | null;
    realizedPnlPending: boolean;
  };
  engineHealth: EngineHealthReport;
  strategyHealth: StrategyHealthReport;
  swarmReport: ScenarioSwarmReport | null;
  analysisComparison: {
    verdict: string | null;
    swarmSignal: string | null;
    swarmAgreement: string | null;
    scenarioNote: string | null;
    noTradeBlockReason: string | null;
  };
  agentScoreboard: import("@/lib/agents/agent-score-types").AgentScoreboard;
  regime: import("@/lib/regime/regime-types").RegimeClassification | null;
  regimeMemory: import("@/lib/regime/regime-types").RegimeMemoryResult;
  ruleEvaluation: import("@/lib/rules/no-trade-rule-types").RuleEvaluationResult | null;
  improvements: import("@/lib/improvement/improvement-types").ImprovementProposal[];
  strategyVersions: import("@/lib/versioning/strategy-version-types").StrategyVersionSnapshot;
  readyForMvp5: boolean;
  readyForMvp5Message: string;
  latestBriefing: DailyBriefing | null;
  portfolioRisk: PortfolioRiskReport;
  portfolioRiskHistory: PortfolioRiskHistoryEntry[];
  microLiveReadiness: MicroLiveReadinessReport;
  latestAuditPack: AuditPack | null;
  liveSandbox: LiveSandboxStatus;
  legacy: {
    readiness: {
      status: string;
      message: string;
      liveLocked: true;
    };
    strategyHealth: string;
    riskBudget: string;
  };
}

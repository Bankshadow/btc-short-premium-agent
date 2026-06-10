import type { ClosePreview } from "@/lib/execution/close-preview-types";
import type { CloseSafetyResult } from "@/lib/execution/close-safety-gate";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { OrderPreview } from "@/lib/execution/preview-types";
import type {
  ExecutionSafetyResult,
  ExecutionSafetyStatus,
} from "@/lib/execution/execution-safety-types";
import type { OpenTradeWithPosition } from "@/lib/trades/trade-query";
import type { ClosedTrade } from "@/lib/trades/trade-types";
import type { PositionSnapshot } from "@/lib/positions/position-types";
import type { ReconciliationResult } from "@/lib/positions/position-types";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { EngineHealthReport } from "@/lib/health/engine-health-types";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import type { StrategyHealthReport } from "@/lib/strategy/strategy-types";

export type MissionSnapshotView = MissionSnapshot & {
  sprint?: string;
  testnetConfigured?: boolean;
  binanceStatus?: BinanceStatusDiagnostics;
  riskPolicy?: {
    liveLocked: true;
    testnetOnly: true;
    requireDoubleConfirm: true;
  };
  nextAction?: string;
  latestPreview?: OrderPreview | null;
  previewCount?: number;
  latestPreviewStatus?: string | null;
  executionEnabled?: boolean;
  latestExecutionReview?: ExecutionSafetyResult | null;
  executionSafetyStatus?: ExecutionSafetyStatus;
  latestOpenTrade?: OpenTradeWithPosition | null;
  latestPosition?: PositionSnapshot | null;
  reconciliation?: ReconciliationResult | null;
  executionCount?: number;
  readyForMvp5?: boolean;
  readyForMvp5Message?: string;
  evidenceProgress?: { valid: number; required: number; invalid: number };
  latestClosePreview?: ClosePreview | null;
  latestCloseReview?: CloseSafetyResult | null;
  latestClosedTrade?: ClosedTrade | null;
  engineHealth?: EngineHealthReport | null;
  strategyHealth?: StrategyHealthReport | null;
  swarmReport?: ScenarioSwarmReport | null;
  latestRegime?: string | null;
  noTradeBlockReason?: string | null;
  scenarioNote?: string | null;
  portfolioRiskStatus?: string;
};
export type { MissionSnapshot };

export type AnalysisVerdict = "WAIT" | "TRADE" | "BLOCKED";

import type { ScenarioContextReference, SwarmAgreement } from "./scenario-context";
import type { RegimeTag } from "@/lib/regime/regime-types";
import type { RuleEvaluationResult } from "@/lib/rules/no-trade-rule-types";

export interface VerdictPayload {
  verdict: AnalysisVerdict;
  confidence: number;
  reasons: string[];
  scenarioContext?: ScenarioContextReference;
  swarmAgreement?: SwarmAgreement;
  scenarioNote?: string;
  regime?: RegimeTag;
  strategyVersionId?: string;
  noTradeBlockReason?: string | null;
}

export interface AnalysisResult {
  runId: string;
  decisionLogId: string;
  verdict: VerdictPayload;
  previewId: string | null;
  preview: import("@/lib/execution/preview-types").OrderPreview | null;
  missionSnapshot: import("@/lib/mission/mission-types").MissionSnapshot;
  scenarioContext?: ScenarioContextReference | null;
  swarmAgreement?: SwarmAgreement;
  scenarioNote?: string;
  regime?: RegimeTag;
  noTradeRules?: RuleEvaluationResult;
  strategyVersionId?: string;
}

export type ScenarioAwareAnalysisResult = AnalysisResult;

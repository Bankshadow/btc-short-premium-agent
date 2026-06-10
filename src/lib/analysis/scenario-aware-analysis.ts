import { hasBinanceApiCredentials } from "@/lib/execution/binance-testnet-client";
import { MISSING_BINANCE_CREDENTIALS_REASON } from "@/lib/execution/binance-testnet-config";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { isTestnetConfigured } from "@/lib/risk/risk-gate";
import { isOperatorBlockedSync, getLatestManualNoteText, hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import { getKillSwitchState } from "@/lib/operator/kill-switch";
import { buildStrategyHealthView } from "@/lib/strategy/strategy-health";
import { ensureBaselineStrategyVersion } from "@/lib/versioning/change-control";
import { getActiveStrategyVersionId } from "@/lib/versioning/strategy-version-store";
import { runCollaborationLoop } from "@/lib/collaboration/collaboration-runner";
import type { CommitteeSummary } from "@/lib/collaboration/collaboration-types";
import { classifyAndStoreRegime, retrieveRegimeMemory } from "@/lib/regime/regime-retrieval";
import type { RegimeClassification, RegimeMemoryResult } from "@/lib/regime/regime-types";
import { runRuleEvaluation } from "@/lib/rules/rule-evaluator";
import type { RuleEvaluationResult } from "@/lib/rules/no-trade-rule-types";
import {
  compareVerdictWithSwarm,
  loadScenarioContext,
  type ScenarioContextReference,
  type SwarmAgreement,
} from "./scenario-context";
import type { AnalysisVerdict, VerdictPayload } from "./analysis-types";

function shouldMockTradeVerdict(events: JournalEvent[]): boolean {
  const flag = process.env.V2_MVP2_MOCK_TRADE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  const priorVerdicts = events.filter((e) => e.type === "VERDICT_CREATED").length;
  return priorVerdicts % 2 === 0;
}

export function computeBaseVerdict(priorEvents: JournalEvent[]): {
  verdict: AnalysisVerdict;
  reasons: string[];
  confidence: number;
} {
  let verdict: AnalysisVerdict = "WAIT";
  const reasons: string[] = [];
  let confidence = 45;

  if (!isTestnetConfigured()) {
    verdict = "BLOCKED";
    reasons.push("Testnet not configured — set BINANCE_TESTNET_ENABLED=true.");
    confidence = 0;
  } else if (getKillSwitchState().active) {
    verdict = "BLOCKED";
    reasons.push(getKillSwitchState().reason ?? "Kill switch active.");
    confidence = 0;
  } else if (isOperatorBlockedSync().blocked) {
    verdict = "BLOCKED";
    reasons.push(isOperatorBlockedSync().reason ?? "Operator blocked.");
    confidence = 0;
  } else if (shouldMockTradeVerdict(priorEvents)) {
    const mockTradeExplicit =
      process.env.V2_MVP2_MOCK_TRADE?.trim().toLowerCase() === "true" ||
      process.env.V2_MVP2_MOCK_TRADE?.trim() === "1";
    if (!hasBinanceApiCredentials() && !mockTradeExplicit) {
      verdict = "BLOCKED";
      reasons.push(`Binance Testnet not configured — ${MISSING_BINANCE_CREDENTIALS_REASON}`);
      confidence = 0;
    } else {
      verdict = "TRADE";
      reasons.push("MVP 2 mock trade signal — preview will be created, no execution.");
      confidence = 62;
    }
  } else {
    verdict = "WAIT";
    reasons.push("No trade signal this cycle — wait for next analysis run.");
    confidence = 42;
  }

  return { verdict, reasons, confidence };
}

export interface ScenarioAwareAnalysisResult {
  baseVerdict: AnalysisVerdict;
  finalVerdict: AnalysisVerdict;
  verdict: VerdictPayload;
  scenarioContext: ScenarioContextReference | null;
  swarmAgreement: SwarmAgreement;
  scenarioNote: string;
  regime: RegimeClassification;
  regimeMemory: RegimeMemoryResult;
  noTradeRules: RuleEvaluationResult;
  collaboration: CommitteeSummary;
  strategyVersionId: string;
  strategyHealthMessage: string;
}

export async function runScenarioAwareAnalysis(input: {
  runId: string;
  decisionLogId: string;
  priorEvents: JournalEvent[];
}): Promise<ScenarioAwareAnalysisResult> {
  await hydrateOperatorGateState();
  await ensureBaselineStrategyVersion();
  const strategyVersionId = await getActiveStrategyVersionId();

  const scenarioContext = await loadScenarioContext();
  if (scenarioContext) {
    await appendEvent({
      type: "SCENARIO_CONTEXT_INJECTED",
      environment: "testnet",
      runId: input.runId,
      decisionLogId: input.decisionLogId,
      payload: { ...scenarioContext },
    });
  }

  const regime = await classifyAndStoreRegime();
  const regimeMemory = await retrieveRegimeMemory(regime);

  if (regime.regime === "UNKNOWN") {
    // Advisory confidence reduction — does not force TRADE
  }

  const collaboration = await runCollaborationLoop(input.runId);
  const strategyHealth = await buildStrategyHealthView();

  const base = computeBaseVerdict(input.priorEvents);
  let verdict = base.verdict;
  let confidence = base.confidence;
  const reasons = [...base.reasons];

  if (scenarioContext) {
    reasons.push(`Scenario context: ${scenarioContext.likelyScenario} (${scenarioContext.advisorySignal}).`);
    if (scenarioContext.advisorySignal === "RISK_OFF" || scenarioContext.recommendedAction === "REDUCE_RISK") {
      reasons.push("Swarm advisory RISK_OFF — cannot force TRADE from scenario alone.");
      if (verdict === "TRADE") {
        // Swarm cannot upgrade to TRADE; only note disagreement
      }
    }
  }

  if (regime.regime === "UNKNOWN" && verdict === "TRADE") {
    confidence = Math.max(0, confidence - 15);
    reasons.push("Regime UNKNOWN — confidence reduced.");
  }

  if (regimeMemory.lessons.length > 0) {
    reasons.push(`Regime memory: ${regimeMemory.lessons[0]}`);
  }

  const manualNote = await getLatestManualNoteText();
  if (manualNote) {
    reasons.push(`Operator note: ${manualNote}`);
  }

  if (collaboration.finalRecommendation === "BLOCKED" && verdict === "TRADE") {
    reasons.push("Committee advisory BLOCKED — note only, risk gate decides.");
  }

  reasons.push(strategyHealth.message);

  const { agreement, note } = compareVerdictWithSwarm(verdict, scenarioContext);
  reasons.push(note);

  const noTradeRules = await runRuleEvaluation({
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    proposedVerdict: verdict,
    swarmAgreement: agreement,
    regime: regime.regime,
  });

  let finalVerdict = verdict;
  if (noTradeRules.blocked && verdict === "TRADE") {
    finalVerdict = "BLOCKED";
    reasons.push(`No-trade rule engine blocked TRADE: ${noTradeRules.blockReason}.`);
    confidence = Math.min(confidence, 30);
  }

  // Swarm bullish can NEVER force TRADE — base verdict already controls TRADE signal
  if (scenarioContext?.advisorySignal === "BULLISH" && base.verdict !== "TRADE") {
    reasons.push("Bullish swarm cannot override WAIT/BLOCKED verdict.");
  }

  const verdictPayload: VerdictPayload = {
    verdict: finalVerdict,
    confidence,
    reasons,
    scenarioContext: scenarioContext ?? undefined,
    swarmAgreement: agreement,
    scenarioNote: note,
    regime: regime.regime,
    strategyVersionId,
    noTradeBlockReason: noTradeRules.blockReason,
  };

  await appendEvent({
    type: "VERDICT_CREATED",
    environment: "testnet",
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    payload: verdictPayload as unknown as Record<string, unknown>,
  });

  await appendEvent({
    type: "ANALYSIS_WITH_SCENARIO_COMPLETED",
    environment: "testnet",
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    payload: {
      baseVerdict: base.verdict,
      finalVerdict,
      swarmAgreement: agreement,
      scenarioReportId: scenarioContext?.reportId ?? null,
      regime: regime.regime,
      strategyVersionId,
    },
  });

  return {
    baseVerdict: base.verdict,
    finalVerdict,
    verdict: verdictPayload,
    scenarioContext,
    swarmAgreement: agreement,
    scenarioNote: note,
    regime,
    regimeMemory,
    noTradeRules,
    collaboration,
    strategyVersionId,
    strategyHealthMessage: strategyHealth.message,
  };
}

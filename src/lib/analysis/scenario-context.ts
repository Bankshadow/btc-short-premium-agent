import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import type { AdvisorySignal, RecommendedAction } from "@/lib/skills/mirofish-swarm/swarm-types";

export interface ScenarioContextReference {
  reportId: string;
  runId: string;
  advisorySignal: AdvisorySignal;
  recommendedAction: RecommendedAction;
  likelyScenario: string;
  confidence: number;
  safetyNote: string;
  injectedAt: string;
}

export async function loadScenarioContext(): Promise<ScenarioContextReference | null> {
  const report = await getLatestSwarmReport();
  if (!report) return null;

  return {
    reportId: report.reportId,
    runId: report.runId,
    advisorySignal: report.advisorySignal,
    recommendedAction: report.recommendedAction,
    likelyScenario: report.likelyScenario,
    confidence: report.confidence,
    safetyNote: report.safetyNote,
    injectedAt: new Date().toISOString(),
  };
}

export type SwarmAgreement = "AGREE" | "DISAGREE" | "NEUTRAL" | "NO_SCENARIO";

export function compareVerdictWithSwarm(
  verdict: "WAIT" | "TRADE" | "BLOCKED",
  scenario: ScenarioContextReference | null,
): { agreement: SwarmAgreement; note: string } {
  if (!scenario) {
    return { agreement: "NO_SCENARIO", note: "No scenario swarm report available." };
  }

  const bullish = scenario.advisorySignal === "BULLISH";
  const bearish = scenario.advisorySignal === "BEARISH" || scenario.advisorySignal === "RISK_OFF";
  const riskOff = scenario.recommendedAction === "REDUCE_RISK";

  if (verdict === "TRADE" && bullish && !riskOff) {
    return {
      agreement: "AGREE",
      note: `Verdict TRADE aligns with swarm ${scenario.advisorySignal} — advisory context only.`,
    };
  }
  if (verdict === "WAIT" && (bearish || riskOff || scenario.advisorySignal === "NEUTRAL")) {
    return {
      agreement: "AGREE",
      note: `Verdict WAIT aligns with swarm ${scenario.advisorySignal} / ${scenario.recommendedAction}.`,
    };
  }
  if (verdict === "BLOCKED") {
    return {
      agreement: "NEUTRAL",
      note: `Verdict BLOCKED — risk gate final; swarm ${scenario.advisorySignal} is advisory only.`,
    };
  }
  if (verdict === "TRADE" && (bearish || riskOff)) {
    return {
      agreement: "DISAGREE",
      note: `Verdict TRADE disagrees with swarm ${scenario.advisorySignal} — risk gate may still block.`,
    };
  }
  if (verdict === "WAIT" && bullish) {
    return {
      agreement: "DISAGREE",
      note: `Verdict WAIT despite bullish swarm — no auto-trade from scenario signal.`,
    };
  }

  return {
    agreement: "NEUTRAL",
    note: `Mixed signals — swarm ${scenario.advisorySignal}, verdict ${verdict}.`,
  };
}

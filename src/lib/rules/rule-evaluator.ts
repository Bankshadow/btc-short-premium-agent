import { appendEvent } from "@/lib/journal/journal-query";
import { evaluateNoTradeRules } from "./no-trade-rule-engine";
import type { SwarmAgreement } from "@/lib/analysis/scenario-context";
import type { RegimeTag } from "@/lib/regime/regime-types";
import type { RuleEvaluationResult } from "./no-trade-rule-types";

export async function runRuleEvaluation(input: {
  runId: string;
  decisionLogId: string;
  proposedVerdict: "TRADE" | "WAIT" | "BLOCKED";
  swarmAgreement: SwarmAgreement;
  regime: RegimeTag;
}): Promise<RuleEvaluationResult> {
  const result = await evaluateNoTradeRules(input);

  await appendEvent({
    type: "RULE_ENGINE_EVALUATED",
    environment: "testnet",
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    payload: {
      proposedVerdict: input.proposedVerdict,
      triggered: result.triggered,
      blocked: result.blocked,
    },
  });

  for (const trigger of result.triggered) {
    await appendEvent({
      type: "NO_TRADE_RULE_TRIGGERED",
      environment: "testnet",
      runId: input.runId,
      decisionLogId: input.decisionLogId,
      payload: { ...trigger },
    });
  }

  if (result.blocked) {
    await appendEvent({
      type: "TRADE_BLOCKED_BY_RULE",
      environment: "testnet",
      runId: input.runId,
      decisionLogId: input.decisionLogId,
      payload: {
        blockReason: result.blockReason,
        triggered: result.triggered.map((t) => t.code),
      },
    });
  }

  return result;
}

export async function getLatestRuleEvaluation(): Promise<RuleEvaluationResult | null> {
  const { getEvents } = await import("@/lib/journal/journal-query");
  const events = await getEvents();
  const evt = [...events]
    .filter((e) => e.type === "RULE_ENGINE_EVALUATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!evt) return null;

  const payload = evt.payload as {
    triggered?: RuleEvaluationResult["triggered"];
    blocked?: boolean;
  };

  const blockers = (payload.triggered ?? []).filter((t) => t.severity === "BLOCK");

  return {
    evaluatedAt: evt.timestamp,
    triggered: payload.triggered ?? [],
    blocked: payload.blocked === true,
    blockReason: blockers.length > 0 ? blockers.map((b) => b.code).join(", ") : null,
    message: payload.blocked ? "Trade blocked by rule engine." : "Rules evaluated.",
  };
}

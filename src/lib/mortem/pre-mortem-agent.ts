import type { PreMortemInput, PreMortemResult, PreMortemVerdict } from "./types";
import type { PreMortemConfidence } from "./types";

function hasClearInvalidation(input: PreMortemInput): boolean {
  const inv =
    input.orderTicketCandidate?.invalidation ??
    input.actionPlan.entryNotes ??
    "";
  const sl = input.actionPlan.slIndexPrice;
  return (
    inv.length > 12 &&
    (inv.toLowerCase().includes("invalid") ||
      inv.toLowerCase().includes("sl") ||
      sl > 0)
  );
}

export function runPreMortemAgent(input: PreMortemInput): PreMortemResult {
  const failureScenarios: string[] = [];
  const riskAmplifiers: string[] = [];
  const invalidationTriggers: string[] = [];
  const mitigationPlan: string[] = [];

  const dt = input.dataTrust;
  const conflict = input.conflict;
  const gate = input.conflictGate;

  if (dt?.grade === "CRITICAL" || !dt?.tradeAllowed) {
    failureScenarios.push("Stale or missing market tape causes wrong entry timing.");
    riskAmplifiers.push(`Data trust ${dt?.grade ?? "CRITICAL"} (${dt?.score ?? 0}/100)`);
  } else if (dt?.grade === "LOW") {
    failureScenarios.push("Partial derivatives data — combination read may be wrong.");
    riskAmplifiers.push("Low data trust — OI/volume gaps");
  }

  if (conflict?.conflictLevel === "CRITICAL" || conflict?.conflictLevel === "HIGH") {
    failureScenarios.push("Agent disagreement — committee TRADE against split desk.");
    riskAmplifiers.push(`Conflict ${conflict.conflictLevel} (${conflict.conflictScore}/100)`);
  } else if (conflict?.conflictLevel === "MEDIUM") {
    riskAmplifiers.push("Medium agent conflict — size must stay reduced");
  }

  if (input.committee.riskVeto) {
    failureScenarios.push("Risk Manager veto ignored if trade proceeds.");
  }

  for (const agent of input.agentOutputs) {
    if (agent.missingData.length > 0 && agent.recommendation === "TRADE") {
      failureScenarios.push(
        `${agent.agentName} traded on incomplete inputs: ${agent.missingData.join(", ")}.`,
      );
    }
  }

  if (input.riskManager.vetoReasons?.length) {
    for (const v of input.riskManager.vetoReasons.slice(0, 2)) {
      failureScenarios.push(`Risk rule at risk: ${v}`);
    }
  }

  const macroBear =
    input.market.ivHvRatio > 0 && input.market.ivHvRatio < 1.05;
  if (macroBear && input.actionPlan.action === "sell_call") {
    failureScenarios.push("IV/HV compression — premium may not pay for tail risk.");
  }

  if (input.market.fundingRate > 0.0003) {
    invalidationTriggers.push("Funding flips sharply negative — squeeze risk.");
  }
  if (input.actionPlan.slIndexPrice > 0) {
    invalidationTriggers.push(
      `BTC index closes beyond SL ${input.actionPlan.slIndexPrice.toLocaleString()}.`,
    );
  }
  invalidationTriggers.push("Liquidation cascade > $200M hard rule zone.");
  invalidationTriggers.push("Macro event before settlement window.");

  mitigationPlan.push("Monitor funding + OI 1h/24h every session until exit.");
  mitigationPlan.push("Re-run analyze if BTC moves >1.5× 4H ATR from entry.");
  mitigationPlan.push("Force pin exit per playbook — no hold through settlement.");
  if (dt?.grade === "MEDIUM") {
    mitigationPlan.push("Paper-only size — do not increase until data trust HIGH.");
  }

  const clearInv = hasClearInvalidation(input);
  if (!clearInv) {
    failureScenarios.push("No explicit invalidation on ticket — cannot define exit discipline.");
  }

  let preMortemVerdict: PreMortemVerdict = "PASS";
  let confidence: PreMortemConfidence = "HIGH";

  if (
    dt?.grade === "CRITICAL" ||
    dt?.grade === "LOW" ||
    !dt?.tradeAllowed ||
    conflict?.conflictLevel === "CRITICAL" ||
    gate?.tradeBlocked ||
    !clearInv
  ) {
    preMortemVerdict = "BLOCK";
    confidence = "LOW";
  } else if (
    conflict?.conflictLevel === "HIGH" ||
    dt?.grade === "MEDIUM" ||
    conflict?.conflictLevel === "MEDIUM" ||
    input.committee.riskVeto
  ) {
    preMortemVerdict = "CAUTION";
    confidence = "MEDIUM";
  }

  if (failureScenarios.length === 0) {
    failureScenarios.push(
      "Adverse move through SL before premium decay captures target.",
    );
  }

  const topFailureReason = failureScenarios[0] ?? "Undefined tail risk on short premium.";

  return {
    preMortemId: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tradeId: input.orderTicketCandidate?.id,
    failureScenarios: failureScenarios.slice(0, 6),
    topFailureReason,
    riskAmplifiers: riskAmplifiers.slice(0, 5),
    invalidationTriggers: invalidationTriggers.slice(0, 5),
    mitigationPlan: mitigationPlan.slice(0, 5),
    preMortemVerdict,
    confidence,
    generatedAt: input.analyzedAt,
  };
}

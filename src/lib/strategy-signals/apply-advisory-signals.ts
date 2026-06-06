import type { AgentOutput, CommitteeVerdict } from "@/lib/agents/types";
import type { ResearchBrief } from "@/lib/research/research-types";
import type { AdvisoryStrategySignal } from "./types";
import { STRATEGY_SIGNAL_SAFETY_NOTICE } from "./types";

function prefixReason(signal: AdvisoryStrategySignal): string {
  return `[Quant Advisory · ${signal.strategyName}] ${signal.signal} (${signal.confidence})`;
}

function appendReasons(agent: AgentOutput, lines: string[]): AgentOutput {
  return {
    ...agent,
    reasons: [...lines, ...agent.reasons].slice(0, 10),
  };
}

function appendRisks(agent: AgentOutput, lines: string[]): AgentOutput {
  return {
    ...agent,
    risks: [...lines.map((l) => `[Quant] ${l}`), ...agent.risks].slice(0, 8),
  };
}

function signalOpposesAgent(
  signal: AdvisoryStrategySignal,
  agent: AgentOutput,
): boolean {
  if (signal.signal === "FLAT" || agent.recommendation === "SKIP") return false;
  if (signal.signal === "LONG" && agent.recommendation === "TRADE") {
    return agent.marketView.toLowerCase().includes("short");
  }
  if (signal.signal === "SHORT" && agent.recommendation === "TRADE") {
    return agent.marketView.toLowerCase().includes("long");
  }
  return false;
}

/**
 * Injects approved quant signals into desk agents as advisory context only.
 * Never sets risk veto, never flips committee verdict to TRADE, never enables execution.
 */
export function applyAdvisorySignalsToDesk(input: {
  signals: AdvisoryStrategySignal[];
  research: ResearchBrief;
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  riskManager: AgentOutput;
  committee: CommitteeVerdict;
}): {
  research: ResearchBrief;
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  riskManager: AgentOutput;
  committee: CommitteeVerdict;
} {
  if (input.signals.length === 0) {
    return {
      research: input.research,
      spot: input.spot,
      futures: input.futures,
      options: input.options,
      riskManager: input.riskManager,
      committee: input.committee,
    };
  }

  let spot = input.spot;
  let futures = input.futures;
  let options = input.options;
  let riskManager = { ...input.riskManager };
  let research = input.research;

  for (const signal of input.signals) {
    const line = `${prefixReason(signal)} — ${signal.reasons[0] ?? "advisory input"}`;
    const invalidation = `Invalidation: ${signal.invalidationCondition}`;

    if (signal.fedTo.includes("FUTURES")) {
      futures = appendReasons(futures, [line, invalidation]);
      if (signalOpposesAgent(signal, futures)) {
        futures = appendRisks(futures, [
          `Quant ${signal.signal} opposes futures agent bias — committee must reconcile.`,
        ]);
      }
    }

    if (signal.fedTo.includes("OPTIONS")) {
      options = appendReasons(options, [line, invalidation]);
      if (signalOpposesAgent(signal, options)) {
        options = appendRisks(options, [
          `Quant ${signal.signal} opposes options agent bias — filter only.`,
        ]);
      }
    }

    if (signal.fedTo.includes("RISK_MANAGER") || signal.suggestedUse === "RISK_GATE") {
      riskManager = appendReasons(riskManager, [
        `${line} (risk overlay — does not replace hard veto rules)`,
        invalidation,
      ]);
      riskManager = appendRisks(riskManager, signal.risks.slice(0, 2));
    }

    if (signal.fedTo.includes("MARKET_DATA")) {
      research = {
        ...research,
        summaryBullets: [
          `${prefixReason(signal)} on BTC 4H`,
          ...research.summaryBullets,
        ].slice(0, 8),
        agents: research.agents.map((agent) =>
          agent.agentName === "Market Data Agent"
            ? appendReasons(agent, [line])
            : agent,
        ),
      };
    }
  }

  const advisorySummary = input.signals
    .map((s) => `${s.strategyName}: ${s.signal} (${s.confidence})`)
    .join(" · ");

  const committee: CommitteeVerdict = {
    ...input.committee,
    topReasons: [
      `[Quant Advisory] ${input.signals.length} approved signal(s) — one committee input, not decisive.`,
      advisorySummary,
      ...input.committee.topReasons,
    ].slice(0, 8),
    agreementNotes: [
      ...input.committee.agreementNotes,
      "Quant strategy signals are advisory; Risk Manager veto remains final gate.",
    ],
  };

  if (spot.recommendation === "TRADE") {
    spot = appendReasons(spot, [
      "Spot agent unchanged by quant overlay — committee majority rules.",
    ]);
  }

  return {
    research,
    spot,
    futures,
    options,
    riskManager,
    committee,
  };
}

export function buildStrategySignalsNotice(signalCount: number): string {
  if (signalCount === 0) return STRATEGY_SIGNAL_SAFETY_NOTICE;
  return `${signalCount} approved quant signal(s) fed to agents as advisory input. ${STRATEGY_SIGNAL_SAFETY_NOTICE}`;
}

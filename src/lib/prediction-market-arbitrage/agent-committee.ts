import { PREDICTION_ARB_DEFAULTS } from "./config";
import type {
  AgentVote,
  CommitteeVerdict,
  DepthAnalysis,
  ExecutionSimulation,
  RawMispricingCandidate,
  ResolutionRiskScore,
} from "./types";

export interface CommitteeInput {
  candidate: RawMispricingCandidate;
  depth: DepthAnalysis;
  simulation: ExecutionSimulation;
  resolution: ResolutionRiskScore;
  portfolioUsedUsd?: number;
  config?: typeof PREDICTION_ARB_DEFAULTS;
}

export interface CommitteeResult {
  verdict: CommitteeVerdict;
  summary: string;
  agentVotes: AgentVote[];
  noTradeReason: string | null;
}

function runScannerAgent(candidate: RawMispricingCandidate): AgentVote {
  const rec: CommitteeVerdict =
    candidate.theoreticalEdgePct >= PREDICTION_ARB_DEFAULTS.minTheoreticalEdgePct
      ? "WATCH"
      : "NO_TRADE";
  return {
    agentName: "Scanner Agent",
    recommendation: candidate.theoreticalEdgePct >= 1.2 ? "TRADE" : rec,
    confidence: Math.min(90, 50 + candidate.theoreticalEdgePct * 5),
    reasons: candidate.reasons,
    risks: ["Theoretical edge may not survive fees and depth."],
  };
}

function runRiskAgent(
  resolution: ResolutionRiskScore,
  simulation: ExecutionSimulation,
): AgentVote {
  if (resolution.blocked) {
    return {
      agentName: "Risk Agent",
      recommendation: "NO_TRADE",
      confidence: 85,
      reasons: [resolution.summary, ...resolution.flags],
      risks: ["Resolution risk above desk threshold."],
    };
  }
  if (simulation.worstCaseLossUsd > simulation.expectedProfitUsd * 2) {
    return {
      agentName: "Risk Agent",
      recommendation: "WATCH",
      confidence: 60,
      reasons: ["Worst-case loss exceeds 2× expected profit."],
      risks: ["Tail risk from oracle / settlement."],
    };
  }
  return {
    agentName: "Risk Agent",
    recommendation: "TRADE",
    confidence: 70,
    reasons: [resolution.summary],
    risks: resolution.flags,
  };
}

function runExecutionAgent(
  depth: DepthAnalysis,
  simulation: ExecutionSimulation,
  config: typeof PREDICTION_ARB_DEFAULTS,
): AgentVote {
  if (depth.depthRejected) {
    return {
      agentName: "Execution Agent",
      recommendation: "NO_TRADE",
      confidence: 80,
      reasons: [depth.depthRejectReason ?? "Depth rejected."],
      risks: ["Fill quality insufficient."],
    };
  }
  if (simulation.executableEdgePct < config.minExecutableEdgePct) {
    return {
      agentName: "Execution Agent",
      recommendation: "NO_TRADE",
      confidence: 75,
      reasons: [
        `Executable edge ${simulation.executableEdgePct.toFixed(2)}% below ${config.minExecutableEdgePct}% floor.`,
      ],
      risks: ["Top-of-book mirage possible."],
    };
  }
  return {
    agentName: "Execution Agent",
    recommendation: simulation.executableEdgePct >= 1.5 ? "TRADE" : "WATCH",
    confidence: simulation.confidenceScore,
    reasons: [
      `VWAP bundle ${depth.vwapBundleCost.toFixed(4)} · size $${depth.executableSizeUsd.toFixed(0)}.`,
      ...simulation.notes,
    ],
    risks: depth.topOfBookOnly ? ["Thin depth — partial fills likely."] : [],
  };
}

function runPortfolioAgent(
  simulation: ExecutionSimulation,
  portfolioUsedUsd: number,
  config: typeof PREDICTION_ARB_DEFAULTS,
): AgentVote {
  const remaining = config.portfolioBudgetUsd - portfolioUsedUsd;
  if (simulation.requiredCapitalUsd > remaining) {
    return {
      agentName: "Portfolio Agent",
      recommendation: "NO_TRADE",
      confidence: 78,
      reasons: [
        `Requires $${simulation.requiredCapitalUsd} · only $${remaining.toFixed(0)} paper budget left.`,
      ],
      risks: ["Capital allocation limit."],
    };
  }
  if (simulation.requiredCapitalUsd > config.maxCapitalPerOpportunityUsd) {
    return {
      agentName: "Portfolio Agent",
      recommendation: "WATCH",
      confidence: 55,
      reasons: ["Size exceeds per-opportunity cap — scale down."],
      risks: [],
    };
  }
  return {
    agentName: "Portfolio Agent",
    recommendation: "TRADE",
    confidence: 65,
    reasons: [
      `Paper allocation $${simulation.requiredCapitalUsd} of $${config.portfolioBudgetUsd} budget.`,
    ],
    risks: [`Capital locked ~${simulation.capitalLockHours}h until resolution.`],
  };
}

function majorityVerdict(votes: AgentVote[]): CommitteeVerdict {
  const weights: Record<CommitteeVerdict, number> = {
    TRADE: 0,
    WATCH: 0,
    NO_TRADE: 0,
  };
  for (const vote of votes) {
    weights[vote.recommendation] += vote.confidence;
  }
  if (weights.NO_TRADE >= weights.TRADE && weights.NO_TRADE >= weights.WATCH) {
    return "NO_TRADE";
  }
  if (weights.TRADE > weights.WATCH && weights.TRADE > weights.NO_TRADE) {
    return "TRADE";
  }
  return "WATCH";
}

/**
 * AgentCommittee — Scanner, Risk, Execution, Portfolio agents.
 */
export function runPredictionArbCommittee(input: CommitteeInput): CommitteeResult {
  const config = input.config ?? PREDICTION_ARB_DEFAULTS;
  const scanner = runScannerAgent(input.candidate);
  const risk = runRiskAgent(input.resolution, input.simulation);
  const execution = runExecutionAgent(input.depth, input.simulation, config);
  const portfolio = runPortfolioAgent(
    input.simulation,
    input.portfolioUsedUsd ?? 0,
    config,
  );

  const agentVotes = [scanner, risk, execution, portfolio];
  let verdict = majorityVerdict(agentVotes);

  if (risk.recommendation === "NO_TRADE") verdict = "NO_TRADE";
  if (execution.recommendation === "NO_TRADE") verdict = "NO_TRADE";
  if (input.resolution.blocked) verdict = "NO_TRADE";

  const noTradeReason =
    verdict === "NO_TRADE"
      ? agentVotes
          .filter((v) => v.recommendation === "NO_TRADE")
          .flatMap((v) => v.reasons)[0] ?? "Committee rejected opportunity."
      : null;

  const summary =
    verdict === "TRADE"
      ? `Committee TRADE — paper sim edge ${input.simulation.executableEdgePct.toFixed(2)}% · confidence ${input.simulation.confidenceScore}.`
      : verdict === "WATCH"
        ? "Committee WATCH — edge present but execution or risk caveats remain."
        : `Committee NO_TRADE — ${noTradeReason ?? "blocked"}.`;

  return { verdict, summary, agentVotes, noTradeReason };
}

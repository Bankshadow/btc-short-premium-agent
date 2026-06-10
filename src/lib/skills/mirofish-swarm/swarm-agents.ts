import type { AgentVote, AdvisorySignal } from "./swarm-types";

const AGENT_ROLES = [
  "Bull Case Agent",
  "Bear Case Agent",
  "Volatility Agent",
  "Liquidity Agent",
  "News Reaction Agent",
  "Risk-Off Agent",
  "Contrarian Agent",
  "Execution Skeptic Agent",
] as const;

function voteForRole(role: string, ctx: { netPnl: number; openPositions: number }): AgentVote {
  let vote: AdvisorySignal = "NEUTRAL";
  let confidence = 0.55;
  let reasoning = "Baseline neutral read from mission snapshot.";
  let riskNotes = "Advisory only — no execution.";

  switch (role) {
    case "Bull Case Agent":
      vote = ctx.netPnl >= 0 ? "BULLISH" : "NEUTRAL";
      reasoning = "Recent equity trend supports cautious bullish bias on testnet.";
      confidence = 0.6;
      break;
    case "Bear Case Agent":
      vote = ctx.netPnl < 0 ? "BEARISH" : "NEUTRAL";
      reasoning = "Drawdown or flat equity suggests downside scenario remains plausible.";
      confidence = 0.58;
      break;
    case "Volatility Agent":
      vote = "RISK_OFF";
      reasoning = "Volatility regime unknown — prefer reduced risk until more evidence.";
      confidence = 0.62;
      break;
    case "Liquidity Agent":
      vote = "NEUTRAL";
      reasoning = "Testnet liquidity differs from live — trap risk is theoretical.";
      riskNotes = "Liquidity trap risk on testnet is simulated.";
      break;
    case "News Reaction Agent":
      vote = "NEUTRAL";
      reasoning = "No live news feed wired — neutral placeholder vote.";
      break;
    case "Risk-Off Agent":
      vote = ctx.openPositions > 0 ? "RISK_OFF" : "NEUTRAL";
      reasoning = ctx.openPositions > 0 ? "Open exposure present — reduce risk bias." : "Flat — neutral.";
      confidence = 0.65;
      break;
    case "Contrarian Agent":
      vote = ctx.netPnl >= 0 ? "BEARISH" : "BULLISH";
      reasoning = "Contrarian fade of recent equity direction.";
      confidence = 0.5;
      break;
    case "Execution Skeptic Agent":
      vote = "NEUTRAL";
      reasoning = "Manual gates required — swarm cannot create previews or orders.";
      riskNotes = "Execution skeptic enforces advisory-only boundary.";
      confidence = 0.7;
      break;
  }

  return {
    agentId: role.toLowerCase().replace(/\s+/g, "-"),
    role,
    vote,
    confidence,
    reasoning,
    riskNotes,
  };
}

export function runAgentVotes(ctx: { netPnl: number; openPositions: number }): AgentVote[] {
  return AGENT_ROLES.map((role) => voteForRole(role, ctx));
}

export function aggregateSignal(votes: AgentVote[]): AdvisorySignal {
  const scores: Record<AdvisorySignal, number> = {
    BULLISH: 0,
    BEARISH: 0,
    NEUTRAL: 0,
    RISK_OFF: 0,
  };
  for (const v of votes) scores[v.vote] += v.confidence;
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as AdvisorySignal) ?? "NEUTRAL";
}

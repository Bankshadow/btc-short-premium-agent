/** Canonical agent roster for UI and docs. */

export interface AgentRosterEntry {
  id: string;
  name: string;
  layer: "research" | "strategy" | "thesis" | "risk" | "moderator" | "parallel" | "support";
  role: string;
}

export const TRADING_DESK_AGENTS: AgentRosterEntry[] = [
  { id: "market-data", name: "Market Data Agent", layer: "research", role: "Tape & snapshot quality" },
  { id: "regime", name: "Regime Agent", layer: "research", role: "Market regime classification" },
  { id: "data-quality", name: "Data Quality Agent", layer: "research", role: "Source completeness score" },
  { id: "macro-news", name: "Macro News Agent", layer: "research", role: "Macro & event context" },
  { id: "desk-memory", name: "Desk Memory Agent", layer: "support", role: "Past lessons & memory graph" },
  { id: "bull", name: "Bull Thesis Agent", layer: "thesis", role: "Bull case debate" },
  { id: "bear", name: "Bear Thesis Agent", layer: "thesis", role: "Bear case debate" },
  { id: "spot", name: "Spot Strategy Agent", layer: "strategy", role: "Spot playbook signal" },
  { id: "futures", name: "Futures Strategy Agent", layer: "strategy", role: "Perp direction bias" },
  { id: "options", name: "Options Strategy Agent", layer: "strategy", role: "Short premium / delta" },
  { id: "risk", name: "Risk Manager Agent", layer: "risk", role: "Veto & sizing gate" },
  { id: "committee", name: "Committee Agent", layer: "moderator", role: "Weighted verdict & consensus" },
];

export const PARALLEL_REVIEW_AGENTS: AgentRosterEntry[] = [
  { id: "parallel-strategy", name: "Strategy Agent", layer: "parallel", role: "Strategy health review" },
  { id: "parallel-risk", name: "Risk Agent", layer: "parallel", role: "Risk & loop guard review" },
  { id: "parallel-ux", name: "UX Agent", layer: "parallel", role: "Operator clarity review" },
  { id: "parallel-execution", name: "Execution Agent", layer: "parallel", role: "Testnet execution quality" },
  { id: "parallel-learning", name: "Learning Agent", layer: "parallel", role: "Self-learning backlog" },
  { id: "parallel-strategist", name: "Project Strategist", layer: "parallel", role: "Roadmap & MVP proposals" },
];

export const AGENT_ROSTER_SUMMARY = {
  tradingDeskCount: TRADING_DESK_AGENTS.length,
  parallelReviewCount: PARALLEL_REVIEW_AGENTS.length,
  totalPrimaryAgents:
    TRADING_DESK_AGENTS.length + PARALLEL_REVIEW_AGENTS.length,
  tradingDesk: TRADING_DESK_AGENTS,
  parallelReview: PARALLEL_REVIEW_AGENTS,
  note:
    "Each automation cycle runs 12 desk agents (incl. Committee), then 6 parallel review agents (18 roles). Regime Brain, Second Brain, and adaptive weighting add advisory layers without separate votes.",
};

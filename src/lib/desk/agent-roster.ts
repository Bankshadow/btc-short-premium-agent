import type { AgentOutput, AgentStrategyType } from "@/lib/agents/types";

export type DeskAgentId =
  | "marketData"
  | "regime"
  | "dataQuality"
  | "macroNews"
  | "memory"
  | "bull"
  | "bear"
  | "spot"
  | "futures"
  | "options"
  | "risk"
  | "committee";

export interface DeskAgentMeta {
  id: DeskAgentId;
  name: string;
  role: string;
  desk: string;
  strategyType: AgentStrategyType | "COMMITTEE";
  initials: string;
  accent: string;
}

/** Pipeline order shown in UI while desk runs. */
export const DESK_AGENT_PIPELINE: DeskAgentMeta[] = [
  {
    id: "marketData",
    name: "Market Data",
    role: "Tape & combination",
    desk: "Research",
    strategyType: "RESEARCH",
    initials: "MD",
    accent: "indigo",
  },
  {
    id: "regime",
    name: "Regime",
    role: "Structure label",
    desk: "Research",
    strategyType: "RESEARCH",
    initials: "RG",
    accent: "slate",
  },
  {
    id: "dataQuality",
    name: "Data Quality",
    role: "Completeness gate",
    desk: "Research",
    strategyType: "RESEARCH",
    initials: "DQ",
    accent: "fuchsia",
  },
  {
    id: "macroNews",
    name: "Macro & News",
    role: "Calendar overlay",
    desk: "Research",
    strategyType: "RESEARCH",
    initials: "MN",
    accent: "pink",
  },
  {
    id: "memory",
    name: "Desk Memory",
    role: "Institutional recall",
    desk: "Research",
    strategyType: "MEMORY",
    initials: "DM",
    accent: "violet",
  },
  {
    id: "bull",
    name: "Bull Thesis",
    role: "Risk-on advocate",
    desk: "Thesis",
    strategyType: "THESIS",
    initials: "BL",
    accent: "emerald",
  },
  {
    id: "bear",
    name: "Bear Thesis",
    role: "Risk-off advocate",
    desk: "Thesis",
    strategyType: "THESIS",
    initials: "BR",
    accent: "rose",
  },
  {
    id: "spot",
    name: "Spot Desk",
    role: "Cash & carry",
    desk: "Spot",
    strategyType: "SPOT",
    initials: "SP",
    accent: "sky",
  },
  {
    id: "futures",
    name: "Futures Desk",
    role: "Perp & basis",
    desk: "Derivatives",
    strategyType: "FUTURES",
    initials: "FT",
    accent: "cyan",
  },
  {
    id: "options",
    name: "Options Desk",
    role: "Vol & premium",
    desk: "Derivatives",
    strategyType: "OPTIONS",
    initials: "OP",
    accent: "amber",
  },
  {
    id: "risk",
    name: "Risk Manager",
    role: "Hard veto gate",
    desk: "Risk",
    strategyType: "RISK",
    initials: "RM",
    accent: "orange",
  },
  {
    id: "committee",
    name: "Investment Committee",
    role: "Final verdict",
    desk: "Committee",
    strategyType: "COMMITTEE",
    initials: "IC",
    accent: "zinc",
  },
];

const NAME_TO_ID: Record<string, DeskAgentId> = {
  "Market Data Agent": "marketData",
  "Regime Agent": "regime",
  "Data Quality Agent": "dataQuality",
  "Macro & News Agent": "macroNews",
  "Desk Memory Agent": "memory",
  "Bull Thesis Agent": "bull",
  "Bear Thesis Agent": "bear",
  "Spot Strategy Agent": "spot",
  "Futures Strategy Agent": "futures",
  "Options Strategy Agent": "options",
  "Risk Manager Agent": "risk",
};

export function agentOutputToId(agent: AgentOutput): DeskAgentId | null {
  return NAME_TO_ID[agent.agentName] ?? null;
}

export function accentRingClass(accent: string): string {
  const map: Record<string, string> = {
    indigo: "ring-indigo-500/40",
    slate: "ring-slate-500/40",
    fuchsia: "ring-fuchsia-500/40",
    pink: "ring-pink-500/40",
    violet: "ring-violet-500/40",
    emerald: "ring-emerald-500/40",
    rose: "ring-rose-500/40",
    sky: "ring-sky-500/40",
    cyan: "ring-cyan-500/40",
    amber: "ring-amber-500/40",
    orange: "ring-orange-500/40",
    zinc: "ring-zinc-400/40",
  };
  return map[accent] ?? "ring-zinc-500/30";
}

export function accentBgClass(accent: string): string {
  const map: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-200",
    slate: "bg-slate-500/25 text-slate-200",
    fuchsia: "bg-fuchsia-500/20 text-fuchsia-200",
    pink: "bg-pink-500/20 text-pink-200",
    violet: "bg-violet-500/20 text-violet-200",
    emerald: "bg-emerald-500/20 text-emerald-200",
    rose: "bg-rose-500/20 text-rose-200",
    sky: "bg-sky-500/20 text-sky-200",
    cyan: "bg-cyan-500/20 text-cyan-200",
    amber: "bg-amber-500/20 text-amber-200",
    orange: "bg-orange-500/20 text-orange-200",
    zinc: "bg-zinc-500/25 text-zinc-200",
  };
  return map[accent] ?? "bg-zinc-700 text-zinc-200";
}

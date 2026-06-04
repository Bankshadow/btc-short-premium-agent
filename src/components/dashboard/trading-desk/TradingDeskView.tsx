"use client";

import type { TradingDeskOutput } from "@/lib/agents/types";
import AgentDebateTable from "./AgentDebateTable";
import FinalVerdictPanel from "./FinalVerdictPanel";
import MarketRegimePanel from "./MarketRegimePanel";
import MissionControlPanel from "./MissionControlPanel";
import MultiAgentSummary from "./MultiAgentSummary";
import PortfolioMilestoneTracker from "./PortfolioMilestoneTracker";
import RiskVetoPanel from "./RiskVetoPanel";

interface TradingDeskViewProps {
  desk: TradingDeskOutput;
}

export default function TradingDeskView({ desk }: TradingDeskViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        {desk.disclaimer}
      </div>

      <MissionControlPanel mission={desk.missionControl} />
      <MarketRegimePanel regime={desk.regime} />
      <MultiAgentSummary agents={desk.agents} />
      <AgentDebateTable debate={desk.debate} />
      <RiskVetoPanel riskManager={desk.riskManager} />
      <PortfolioMilestoneTracker milestones={desk.portfolioMilestones} />
      <FinalVerdictPanel verdict={desk.committeeVerdict} />
    </div>
  );
}

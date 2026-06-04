"use client";

import type { TradingDeskOutput } from "@/lib/agents/types";
import BullBearThesis from "./BullBearThesis";
import CommitteeFinalVerdict from "./CommitteeFinalVerdict";
import MultiAgentDebate from "./MultiAgentDebate";
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

      <BullBearThesis bull={desk.bullThesis} bear={desk.bearThesis} />
      <MultiAgentDebate debate={desk.debate} />
      <RiskVetoPanel riskManager={desk.riskManager} />
      <CommitteeFinalVerdict
        committee={desk.committee}
        marketRegime={desk.marketRegime}
      />
    </div>
  );
}

"use client";

import type { TradingDeskOutput } from "@/lib/agents/types";
import DeskMemoryPanel from "../DeskMemoryPanel";
import ResearchDeskPanel from "../research/ResearchDeskPanel";
import BullBearThesis from "./BullBearThesis";
import CommitteeFinalVerdict from "./CommitteeFinalVerdict";
import MultiAgentDebate from "./MultiAgentDebate";
import RiskVetoPanel from "./RiskVetoPanel";

interface TradingDeskViewProps {
  desk: TradingDeskOutput;
  onPinsChange?: () => void;
}

export default function TradingDeskView({
  desk,
  onPinsChange,
}: TradingDeskViewProps) {
  return (
    <div className="relative flex flex-col gap-4">
      <CommitteeFinalVerdict
        committee={desk.committee}
        marketRegime={desk.marketRegime}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BullBearThesis bull={desk.bullThesis} bear={desk.bearThesis} />
        <RiskVetoPanel riskManager={desk.riskManager} />
      </div>

      <MultiAgentDebate debate={desk.debate} agents={desk.agents} />

      <ResearchDeskPanel research={desk.research} />
      <DeskMemoryPanel memory={desk.deskMemory} onPinsChange={onPinsChange} />

      <p className="text-center text-[10px] text-zinc-600">{desk.disclaimer}</p>
    </div>
  );
}

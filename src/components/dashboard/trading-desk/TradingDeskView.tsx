"use client";

import type { TradingDeskOutput } from "@/lib/agents/types";
import type {
  ConflictGateResult,
  DataConfidenceResult,
  DataProvenanceField,
  StrategyConflictAnalysis,
} from "@/lib/data-trust/types";
import DeskMemoryPanel from "../DeskMemoryPanel";
import ResearchDeskPanel from "../research/ResearchDeskPanel";
import BullBearThesis from "./BullBearThesis";
import CommitteeFinalVerdict from "./CommitteeFinalVerdict";
import DataTrustPanel from "./DataTrustPanel";
import MultiAgentDebate from "./MultiAgentDebate";
import RiskVetoPanel from "./RiskVetoPanel";

interface TradingDeskViewProps {
  desk: TradingDeskOutput;
  dataTrust?: DataConfidenceResult;
  dataProvenance?: DataProvenanceField[];
  conflictAnalysis?: StrategyConflictAnalysis;
  conflictGate?: ConflictGateResult;
  onPinsChange?: () => void;
}

export default function TradingDeskView({
  desk,
  dataTrust,
  dataProvenance,
  conflictAnalysis,
  conflictGate,
  onPinsChange,
}: TradingDeskViewProps) {
  const showReliability =
    dataTrust &&
    dataProvenance &&
    conflictAnalysis &&
    conflictGate;

  return (
    <div className="relative flex flex-col gap-4">
      {showReliability && (
        <DataTrustPanel
          dataTrust={dataTrust}
          dataProvenance={dataProvenance}
          conflictAnalysis={conflictAnalysis}
          conflictGate={conflictGate}
        />
      )}

      <CommitteeFinalVerdict
        committee={desk.committee}
        marketRegime={desk.marketRegime}
        conflictGate={conflictGate}
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

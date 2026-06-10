import type { JournalEventType } from "@/lib/journal/journal-types";

export type LoopContractId =
  | "ANALYSIS"
  | "PREVIEW"
  | "EXECUTION_SAFETY"
  | "TESTNET_EXECUTION"
  | "POSITION_MONITOR"
  | "CLOSE"
  | "PNL"
  | "LEARNING"
  | "EVIDENCE"
  | "MIROFISH_SCENARIO"
  | "AGENT_COLLABORATION"
  | "AUDIT";

export interface LoopContract {
  id: LoopContractId;
  description: string;
  expectedEvents: JournalEventType[];
  advisoryOnly?: boolean;
}

export const LOOP_CONTRACTS: LoopContract[] = [
  {
    id: "ANALYSIS",
    description: "Start AI → verdict",
    expectedEvents: ["ANALYSIS_STARTED", "VERDICT_CREATED"],
  },
  {
    id: "PREVIEW",
    description: "TRADE → preview",
    expectedEvents: ["PREVIEW_CREATED"],
  },
  {
    id: "EXECUTION_SAFETY",
    description: "Safety review before execute",
    expectedEvents: ["EXECUTION_REVIEWED"],
  },
  {
    id: "TESTNET_EXECUTION",
    description: "Double confirm → testnet order",
    expectedEvents: ["ORDER_EXECUTED", "POSITION_OPENED"],
  },
  {
    id: "POSITION_MONITOR",
    description: "Refresh open positions",
    expectedEvents: ["POSITION_MONITORED"],
  },
  {
    id: "CLOSE",
    description: "Reduce-only close path",
    expectedEvents: ["CLOSE_PREVIEW_CREATED", "CLOSE_REVIEWED", "CLOSE_ORDER_EXECUTED", "POSITION_CLOSED"],
  },
  {
    id: "PNL",
    description: "Realized PnL after close",
    expectedEvents: ["PNL_REALIZED", "TRADE_RESULT_CLASSIFIED"],
  },
  {
    id: "LEARNING",
    description: "Post-close learning record",
    expectedEvents: ["LEARNING_RECORD_CREATED"],
  },
  {
    id: "EVIDENCE",
    description: "Evidence trade validation",
    expectedEvents: ["EVIDENCE_TRADE_VALIDATED", "EVIDENCE_PROGRESS_UPDATED"],
  },
  {
    id: "MIROFISH_SCENARIO",
    description: "Swarm scenario advisory",
    expectedEvents: ["MIROFISH_SCENARIO_REPORT_CREATED"],
    advisoryOnly: true,
  },
  {
    id: "AGENT_COLLABORATION",
    description: "Committee advisory loop",
    expectedEvents: ["AGENT_CONSENSUS_CREATED"],
    advisoryOnly: true,
  },
  {
    id: "AUDIT",
    description: "Audit pack generation",
    expectedEvents: ["AUDIT_PACK_CREATED"],
    advisoryOnly: true,
  },
];

export function getLoopContract(id: LoopContractId): LoopContract | undefined {
  return LOOP_CONTRACTS.find((c) => c.id === id);
}

import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newImprovementId } from "@/lib/journal/journal-types";
import type { ImprovementProposal, ImprovementProposalType } from "./improvement-types";

function loadProposals(events: Awaited<ReturnType<typeof getEvents>>): ImprovementProposal[] {
  const map = new Map<string, ImprovementProposal>();

  for (const evt of events) {
    if (evt.type === "IMPROVEMENT_PROPOSAL_CREATED") {
      const p = evt.payload as unknown as ImprovementProposal;
      map.set(p.improvementId, p);
    }
    if (evt.type === "IMPROVEMENT_APPROVED" || evt.type === "IMPROVEMENT_REJECTED") {
      const id = String((evt.payload as { improvementId?: string }).improvementId ?? "");
      const existing = map.get(id);
      if (existing) {
        map.set(id, {
          ...existing,
          status: evt.type === "IMPROVEMENT_APPROVED" ? "APPROVED" : "REJECTED",
          decidedAt: evt.timestamp,
          decidedBy: String((evt.payload as { decidedBy?: string }).decidedBy ?? "operator"),
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAllImprovementProposals(): Promise<ImprovementProposal[]> {
  const events = await getEvents();
  return loadProposals(events);
}

export async function generateImprovementProposals(): Promise<ImprovementProposal[]> {
  const events = await getEvents();
  const created: ImprovementProposal[] = [];

  const losses = events.filter(
    (e) => e.type === "PNL_REALIZED" && (e.payload as { result?: string }).result === "LOSS",
  );
  const lossTradeIds = losses.map((e) => e.tradeId).filter(Boolean) as string[];

  if (losses.length >= 2) {
    const proposal: ImprovementProposal = {
      improvementId: newImprovementId(),
      type: "ADD_NO_TRADE_RULE",
      title: "Add no-trade rule after repeated losses",
      description: `${losses.length} recent losses — propose stricter no-trade guardrail.`,
      evidence: lossTradeIds.map((id) => `Loss on trade ${id}`),
      tradeIds: lossTradeIds,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
    };
    await appendEvent({
      type: "IMPROVEMENT_PROPOSAL_CREATED",
      environment: "testnet",
      payload: { ...proposal },
    });
    created.push(proposal);
  }

  const overconfidence = events.filter((e) => e.type === "AGENT_OVERCONFIDENCE_DETECTED");
  if (overconfidence.length >= 1) {
    const proposal: ImprovementProposal = {
      improvementId: newImprovementId(),
      type: "ADJUST_AGENT_WEIGHT",
      title: "Review agent confidence calibration",
      description: "Overconfidence detected — propose advisory weight review (no auto-apply).",
      evidence: overconfidence.map(
        (e) => `Overconfidence: ${(e.payload as { agentId?: string }).agentId}`,
      ),
      tradeIds: overconfidence.map((e) => e.tradeId).filter(Boolean) as string[],
      status: "PENDING",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
    };
    await appendEvent({
      type: "IMPROVEMENT_PROPOSAL_CREATED",
      environment: "testnet",
      payload: { ...proposal },
    });
    created.push(proposal);
  }

  return created;
}

export async function getImprovementById(
  improvementId: string,
): Promise<ImprovementProposal | null> {
  const all = await getAllImprovementProposals();
  return all.find((p) => p.improvementId === improvementId) ?? null;
}

export function proposalRequiresEvidence(proposal: ImprovementProposal): boolean {
  return proposal.evidence.length > 0 && proposal.tradeIds.length >= 0;
}

export type { ImprovementProposalType };

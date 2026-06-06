import type {
  ConsciousMemorySnapshot,
  SecondBrainGraphEdge,
  SecondBrainGraphNode,
  SecondBrainGraphView,
  SecondBrainMemory,
  SecondBrainRelevantLesson,
} from "./types";
import { SECOND_BRAIN_SAFETY_NOTICE } from "./types";

export function buildSecondBrainGraphView(input: {
  conscious: ConsciousMemorySnapshot | null;
  memories: SecondBrainMemory[];
  relevant?: SecondBrainRelevantLesson[];
}): SecondBrainGraphView {
  const nodes: SecondBrainGraphNode[] = [];
  const edges: SecondBrainGraphEdge[] = [];

  if (input.conscious) {
    const c = input.conscious;
    const cid = "conscious:desk";
    nodes.push({
      id: cid,
      layer: "conscious",
      type: "ConsciousState",
      label: "Current desk state",
      summary: [
        c.openPositions.length ? `Positions: ${c.openPositions.join(", ")}` : "Flat",
        c.currentStrategy ? `Strategy: ${c.currentStrategy}` : null,
        `Risk: ${c.riskState}`,
        c.latestAiDecision ? `Decision: ${c.latestAiDecision}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      weight: 10,
    });

    for (const blocker of c.blockers) {
      const bid = `conscious:blocker:${blocker.slice(0, 24)}`;
      nodes.push({
        id: bid,
        layer: "conscious",
        type: "Blocker",
        label: "Blocker",
        summary: blocker,
        weight: 9,
      });
      edges.push({
        id: `e-${cid}-${bid}`,
        from: cid,
        to: bid,
        relation: "warns",
        evidence: "Active safety blocker",
      });
    }
  }

  const active = input.memories.filter((m) => !m.superseded);
  for (const m of active.slice(0, 40)) {
    nodes.push({
      id: m.memoryId,
      layer: "subconscious",
      type: m.type,
      label: m.title,
      summary: m.lesson,
      weight: m.confidence,
    });
    if (m.supersededBy) {
      edges.push({
        id: `e-resolved-${m.memoryId}`,
        from: m.memoryId,
        to: m.supersededBy,
        relation: "resolved_conflict",
        evidence: "Superseded by higher-confidence memory",
      });
    }
  }

  const relevantIds = new Set(
    (input.relevant ?? []).map((r) => r.memoryId),
  );
  const consciousId = "conscious:desk";
  if (input.conscious && relevantIds.size > 0) {
    for (const rid of relevantIds) {
      edges.push({
        id: `e-rel-${rid}`,
        from: consciousId,
        to: rid,
        relation: "relates",
        evidence: "Retrieved for current AI cycle",
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    safetyNotice: SECOND_BRAIN_SAFETY_NOTICE,
  };
}

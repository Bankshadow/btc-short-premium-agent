import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { buildConsciousMemory, consciousToHighlights } from "./build-conscious";
import { resolveMemoryConflicts } from "./resolve-conflicts";
import { retrieveRelevantMemories } from "./retrieve-relevant";
import { buildSecondBrainGraphView } from "./build-graph-view";
import { resetSecondBrainStateForTests } from "./brain-store";
import type { SecondBrainMemory } from "./types";

function mem(
  partial: Partial<SecondBrainMemory> & Pick<SecondBrainMemory, "conflictKey" | "polarity">,
): SecondBrainMemory {
  const now = new Date().toISOString();
  return {
    memoryId: partial.memoryId ?? `m-${Math.random()}`,
    type: partial.type ?? "TradeLesson",
    title: partial.title ?? "Test",
    lesson: partial.lesson ?? "lesson",
    confidence: partial.confidence ?? 50,
    tags: partial.tags ?? [],
    sourceModule: null,
    linkedDecisionId: null,
    linkedTradeId: null,
    createdAt: now,
    updatedAt: now,
    consolidatedAt: now,
    superseded: false,
    supersededBy: null,
    ...partial,
  };
}

describe("Second brain (MVP 74)", () => {
  beforeEach(async () => {
    await resetSecondBrainStateForTests();
  });

  it("builds conscious memory with blockers", () => {
    const c = buildConsciousMemory({
      openPositionLabels: ["BTCUSDT SHORT"],
      currentStrategy: "short-premium",
      riskState: "Paused",
      blockers: ["Daily loss limit"],
    });
    const highlights = consciousToHighlights(c);
    assert.ok(highlights.some((h) => h.includes("BTCUSDT")));
    assert.ok(highlights.some((h) => h.includes("Blocker")));
  });

  it("resolves conflicting memories by confidence", () => {
    const a = mem({
      memoryId: "a",
      conflictKey: "regime:range",
      polarity: "positive",
      confidence: 80,
      lesson: "trade works",
    });
    const b = mem({
      memoryId: "b",
      conflictKey: "regime:range",
      polarity: "negative",
      confidence: 40,
      lesson: "trade fails",
    });
    const { memories, resolvedCount } = resolveMemoryConflicts([a, b]);
    assert.equal(resolvedCount, 1);
    const loser = memories.find((m) => m.memoryId === "b");
    assert.equal(loser?.superseded, true);
    assert.equal(loser?.supersededBy, "a");
  });

  it("retrieves regime-matched lessons", () => {
    const memories = [
      mem({
        memoryId: "win",
        conflictKey: "k1",
        polarity: "positive",
        tags: ["RANGE"],
        lesson: "RANGE breakout long worked",
        confidence: 70,
      }),
      mem({
        memoryId: "other",
        conflictKey: "k2",
        polarity: "neutral",
        tags: ["TREND"],
        lesson: "unrelated",
        confidence: 30,
      }),
    ];
    const relevant = retrieveRelevantMemories(memories, { marketRegime: "RANGE" });
    assert.equal(relevant[0]?.memoryId, "win");
  });

  it("builds graph with conscious and subconscious nodes", () => {
    const conscious = buildConsciousMemory({ blockers: ["Loop guard"] });
    const graph = buildSecondBrainGraphView({
      conscious,
      memories: [
        mem({ memoryId: "m1", conflictKey: "k", polarity: "positive", type: "TradeLesson" }),
      ],
      relevant: [
        {
          memoryId: "m1",
          type: "TradeLesson",
          title: "T",
          lesson: "L",
          score: 10,
          whyUsed: "test",
        },
      ],
    });
    assert.ok(graph.nodes.some((n) => n.layer === "conscious"));
    assert.ok(graph.nodes.some((n) => n.layer === "subconscious"));
    assert.ok(graph.safetyNotice.includes("advisory"));
  });
});

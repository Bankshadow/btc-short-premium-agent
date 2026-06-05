import type {
  MemoryEdge,
  MemoryGraphSnapshot,
  MemoryNode,
  RelevantMemoryContext,
  RelevantMemoryLesson,
  RelevantMemoryResult,
} from "./types";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function scoreNode(node: MemoryNode, ctx: RelevantMemoryContext): number {
  let score = node.weight;

  if (ctx.marketRegime) {
    const rk = `regime:${slug(ctx.marketRegime)}`;
    if (node.id === rk || node.tags.includes(ctx.marketRegime)) score += 4;
  }

  if (ctx.strategy) {
    const sk = `strategy:${slug(ctx.strategy)}`;
    if (node.id === sk || node.tags.includes(ctx.strategy)) score += 5;
  }

  if (ctx.asset) {
    if (node.tags.includes(ctx.asset) || node.summary.toLowerCase().includes(ctx.asset.toLowerCase())) {
      score += 2;
    }
  }

  if (ctx.agentsInvolved?.length) {
    for (const agent of ctx.agentsInvolved) {
      const ak = `agent:${slug(agent)}`;
      if (node.id === ak) score += 4;
    }
  }

  if (ctx.riskProfile === "balanced" && node.type === "risk_event") score += 3;
  if (ctx.riskProfile === "aggressive" && node.type === "strategy") score += 1;

  if (ctx.currentVerdict === "SKIP" && node.type === "rule") score += 2;
  if (ctx.currentVerdict === "TRADE" && node.type === "outcome" && node.id.includes("large_win")) {
    score += 2;
  }

  return score;
}

function scoreEdge(edge: MemoryEdge, ctx: RelevantMemoryContext, nodeScores: Map<string, number>): number {
  let score = edge.weight + (nodeScores.get(edge.from) ?? 0) * 0.3 + (nodeScores.get(edge.to) ?? 0) * 0.3;

  if (ctx.marketRegime && edge.evidence.toLowerCase().includes(ctx.marketRegime.toLowerCase())) {
    score += 3;
  }
  if (ctx.strategy && (edge.from.includes(slug(ctx.strategy)) || edge.to.includes(slug(ctx.strategy)))) {
    score += 3;
  }

  const negativeRelations = new Set([
    "performs_poorly_in",
    "agent_wrong_under",
    "condition_increased_drawdown",
  ]);
  if (negativeRelations.has(edge.relation)) score += 1;

  return score;
}

function lessonFromEdge(edge: MemoryEdge, nodes: Map<string, MemoryNode>): RelevantMemoryLesson {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  const relationLabel = edge.relation.replace(/_/g, " ");
  const bullet = `${from?.label ?? edge.from} ${relationLabel} ${to?.label ?? edge.to}: ${edge.evidence}`;
  return {
    bullet,
    score: edge.weight,
    whyUsed: `Matched edge ${edge.relation} (weight ${edge.weight}) between ${edge.from} and ${edge.to}.`,
    nodeIds: [edge.from, edge.to],
    edgeIds: [edge.id],
  };
}

export function getRelevantMemory(
  snapshot: MemoryGraphSnapshot,
  ctx: RelevantMemoryContext,
): RelevantMemoryResult {
  const limit = ctx.limit ?? 6;
  const nodeMap = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const nodeScores = new Map<string, number>();

  for (const node of snapshot.nodes) {
    nodeScores.set(node.id, scoreNode(node, ctx));
  }

  const rankedEdges = snapshot.edges
    .map((edge) => ({ edge, score: scoreEdge(edge, ctx, nodeScores) }))
    .sort((a, b) => b.score - a.score);

  const lessons: RelevantMemoryLesson[] = [];
  const seen = new Set<string>();

  for (const { edge, score } of rankedEdges) {
    if (lessons.length >= limit) break;
    const key = `${edge.from}-${edge.relation}-${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lesson = lessonFromEdge(edge, nodeMap);
    lesson.score = score;
    lessons.push(lesson);
  }

  for (const node of snapshot.nodes) {
    if (lessons.length >= limit) break;
    const score = nodeScores.get(node.id) ?? 0;
    if (score < 3) continue;
    const key = `node-${node.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lessons.push({
      bullet: `${node.label}: ${node.summary}`,
      score,
      whyUsed: `Node ${node.type} matched context (score ${score.toFixed(1)}).`,
      nodeIds: [node.id],
      edgeIds: [],
    });
  }

  lessons.sort((a, b) => b.score - a.score);

  const usedNodeIds = new Set(lessons.flatMap((l) => l.nodeIds));
  const usedEdgeIds = new Set(lessons.flatMap((l) => l.edgeIds));

  return {
    generatedAt: new Date().toISOString(),
    lessons: lessons.slice(0, limit),
    nodes: snapshot.nodes.filter((n) => usedNodeIds.has(n.id)),
    edges: snapshot.edges.filter((e) => usedEdgeIds.has(e.id)),
    advisoryOnly: true,
    cannotPlaceTrades: true,
    cannotBypassGovernance: true,
  };
}

export function memoryLessonsToBullets(lessons: RelevantMemoryLesson[]): string[] {
  return lessons.map((l) => l.bullet);
}

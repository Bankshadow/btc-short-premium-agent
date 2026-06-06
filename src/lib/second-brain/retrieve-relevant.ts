import type {
  ConsciousMemorySnapshot,
  SecondBrainMemory,
  SecondBrainRelevantLesson,
} from "./types";
import { SECOND_BRAIN_RETRIEVAL_LIMIT } from "./config";

export interface RetrieveContext {
  marketRegime?: string | null;
  symbol?: string | null;
  strategy?: string | null;
  verdict?: string | null;
  blockers?: string[];
  limit?: number;
}

function scoreMemory(
  memory: SecondBrainMemory,
  ctx: RetrieveContext,
  conscious: ConsciousMemorySnapshot | null,
): { score: number; why: string } {
  let score = memory.confidence;
  const tags = memory.tags.map((t) => t.toLowerCase());
  const lesson = memory.lesson.toLowerCase();

  if (ctx.marketRegime) {
    const rk = ctx.marketRegime.toLowerCase();
    if (tags.some((t) => t.includes(rk)) || lesson.includes(rk)) {
      score += 12;
    }
  }
  if (ctx.symbol) {
    const sym = ctx.symbol.toLowerCase();
    if (tags.some((t) => t.includes(sym)) || lesson.includes(sym)) {
      score += 10;
    }
  }
  if (ctx.strategy) {
    const sk = ctx.strategy.toLowerCase();
    if (tags.some((t) => t.includes(sk)) || memory.title.toLowerCase().includes(sk)) {
      score += 8;
    }
  }
  if (ctx.verdict) {
    const v = ctx.verdict.toUpperCase();
    if (tags.some((t) => t.toUpperCase() === v)) score += 6;
  }
  if (memory.polarity === "negative") score += 2;
  if (memory.type === "RiskPattern" || memory.type === "ExecutionIssue") score += 3;

  if (conscious?.blockers.length) {
    const blocker = conscious.blockers[0]?.toLowerCase() ?? "";
    if (blocker && lesson.includes(blocker.slice(0, 20))) score += 8;
  }
  if (conscious?.currentStrategy) {
    const cs = conscious.currentStrategy.toLowerCase();
    if (memory.title.toLowerCase().includes(cs)) score += 5;
  }

  const whyParts: string[] = [`confidence ${memory.confidence}`];
  if (ctx.marketRegime && lesson.includes(ctx.marketRegime.toLowerCase())) {
    whyParts.push("regime match");
  }
  if (memory.polarity === "negative") whyParts.push("risk/loss pattern");

  return { score, why: whyParts.join(" · ") };
}

export function retrieveRelevantMemories(
  memories: SecondBrainMemory[],
  ctx: RetrieveContext,
  conscious: ConsciousMemorySnapshot | null = null,
): SecondBrainRelevantLesson[] {
  const limit = ctx.limit ?? SECOND_BRAIN_RETRIEVAL_LIMIT;
  const active = memories.filter((m) => !m.superseded);

  const ranked = active
    .map((memory) => {
      const { score, why } = scoreMemory(memory, ctx, conscious);
      return {
        memoryId: memory.memoryId,
        type: memory.type,
        title: memory.title,
        lesson: memory.lesson,
        score,
        whyUsed: why,
      };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: SecondBrainRelevantLesson[] = [];
  for (const row of ranked) {
    const key = `${row.type}:${row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function relevantLessonsToBullets(lessons: SecondBrainRelevantLesson[]): string[] {
  return lessons.map((l) => `[${l.type}] ${l.lesson}`);
}

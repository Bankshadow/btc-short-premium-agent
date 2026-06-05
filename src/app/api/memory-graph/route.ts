import { buildMemoryGraph } from "@/lib/memory-graph/build-graph";
import { getRelevantMemory } from "@/lib/memory-graph/get-relevant-memory";
import { MEMORY_GRAPH_SAFETY_NOTICE } from "@/lib/memory-graph/build-graph";
import type { MemoryGraphBuildInput, RelevantMemoryContext } from "@/lib/memory-graph/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MemoryGraphBody = MemoryGraphBuildInput & {
  context?: RelevantMemoryContext;
};

export async function POST(request: Request) {
  try {
    let body: MemoryGraphBody = { entries: [] };
    try {
      body = (await request.json()) as MemoryGraphBody;
    } catch {
      /* empty body */
    }

    const snapshot = buildMemoryGraph({
      entries: body.entries ?? [],
      orders: body.orders,
      draftRules: body.draftRules,
      pinnedNotes: body.pinnedNotes,
      incidents: body.incidents,
      councilSessions: body.councilSessions,
      adaptationProposals: body.adaptationProposals,
      registryStrategies: body.registryStrategies,
    });

    const relevant = getRelevantMemory(snapshot, body.context ?? { limit: 8 });

    return NextResponse.json({
      ok: true,
      snapshot,
      relevant,
      advisoryOnly: true,
      cannotPlaceTrades: true,
      cannotBypassGovernance: true,
      safetyNotice: MEMORY_GRAPH_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Memory graph build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    advisoryOnly: true,
    cannotPlaceTrades: true,
    cannotBypassGovernance: true,
    safetyNotice: MEMORY_GRAPH_SAFETY_NOTICE,
    hint: "POST journal payload to build graph and retrieve relevant lessons.",
  });
}

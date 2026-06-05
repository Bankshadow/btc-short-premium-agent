import { NextResponse } from "next/server";
import type { AgentOutput } from "@/lib/agents/types";
import { computeWeightedCommitteeVerdict } from "@/lib/adaptive-agent-weighting/compute-weighted-verdict";
import type { AdaptiveWeightingAnalyzePayload } from "@/lib/adaptive-agent-weighting/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      payload: AdaptiveWeightingAnalyzePayload;
      agents: AgentOutput[];
      originalVerdict: "TRADE" | "SKIP" | "WAIT";
      marketRegime: string;
      riskVeto?: boolean;
      dataTrustCritical?: boolean;
      preMortemBlock?: boolean;
      governance?: GovernanceAnalyzePayload | null;
      targetStrategy?: string;
    };

    const weighted = computeWeightedCommitteeVerdict({
      settings: body.payload.settings,
      marketRegime: body.marketRegime,
      riskProfile: "balanced",
      agents: body.agents,
      originalVerdict: body.originalVerdict,
      agentEvaluations: body.payload.agentLeaderboard,
      totalResolvedTrades: body.payload.totalResolvedTrades,
      riskVeto: body.riskVeto ?? false,
      dataTrustCritical: body.dataTrustCritical,
      preMortemBlock: body.preMortemBlock,
      governance: body.governance,
      targetStrategy: body.targetStrategy,
    });

    return NextResponse.json({ ok: true, weighted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compute failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

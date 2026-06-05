import { runRuleDiscovery } from "@/lib/rule-discovery/run-discovery";
import { RULE_DISCOVERY_SAFETY_NOTICE } from "@/lib/rule-discovery/types";
import type { RuleDiscoveryInput } from "@/lib/rule-discovery/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RuleDiscoveryInput & {
      storedProposals?: import("@/lib/rule-discovery/types").AutoDiscoveredRuleProposal[];
    };

    const report = runRuleDiscovery(
      {
        entries: body.entries ?? [],
        orders: body.orders,
        perpPositions: body.perpPositions,
        riskProfile: body.riskProfile,
        evaluations: body.evaluations,
        memoryGraph: body.memoryGraph,
        registryStrategies: body.registryStrategies,
      },
      body.storedProposals ?? [],
      false,
    );

    return NextResponse.json({
      ok: true,
      report,
      clientMustPersist: true,
      noAutoApproval: true,
      noDirectLiveChanges: true,
      safetyNotice: RULE_DISCOVERY_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rule discovery failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

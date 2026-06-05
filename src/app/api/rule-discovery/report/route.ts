import { buildRuleDiscoveryReport } from "@/lib/rule-discovery/build-report";
import { RULE_DISCOVERY_SAFETY_NOTICE } from "@/lib/rule-discovery/types";
import type { RuleDiscoveryInput } from "@/lib/rule-discovery/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    noAutoApproval: true,
    noDirectLiveChanges: true,
    safetyNotice: RULE_DISCOVERY_SAFETY_NOTICE,
    hint: "POST entries + storedProposals to build rule discovery report.",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RuleDiscoveryInput & {
      storedProposals?: AutoDiscoveredRuleProposal[];
    };

    const report = buildRuleDiscoveryReport(
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
    );

    return NextResponse.json({
      ok: true,
      report,
      noAutoApproval: true,
      noDirectLiveChanges: true,
      safetyNotice: RULE_DISCOVERY_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rule discovery report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

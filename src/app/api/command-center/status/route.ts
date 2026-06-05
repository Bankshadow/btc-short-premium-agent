import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { COMMAND_CENTER_SAFETY_NOTICE } from "@/lib/command-center/types";
import type { CommandCenterInput } from "@/lib/command-center/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = Partial<
  Omit<CommandCenterInput, "serverContext" | "riskProfile">
> & {
  riskProfile?: DeskRiskProfile;
};

export async function GET() {
  try {
    const serverContext = await buildCommandCenterServerContext();
    const report = buildCommandCenterReport({
      entries: [],
      orders: [],
      riskProfile: "balanced",
      serverContext,
    });

    return NextResponse.json({
      ok: true,
      serverContext,
      report,
      cannotIncreaseRisk: true,
      cannotAutoApproveProposals: true,
      cannotBypassGovernance: true,
      safetyNotice: COMMAND_CENTER_SAFETY_NOTICE,
      hint: "POST with client journal/governance for full command center status.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Command center status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const serverContext = await buildCommandCenterServerContext();
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty body */
    }

    const report = buildCommandCenterReport({
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions,
      paperPositions: body.paperPositions,
      riskProfile: body.riskProfile ?? "balanced",
      governance: body.governance,
      incidents: body.incidents,
      latestAnalysis: body.latestAnalysis,
      riskBudget: body.riskBudget,
      livePilotJournal: body.livePilotJournal,
      emergencyStopActive: body.emergencyStopActive,
      deskManagerActions: body.deskManagerActions,
      adaptationProposals: body.adaptationProposals,
      experiments: body.experiments,
      registry: body.registry,
      automationEnabled: body.automationEnabled,
      serverContext,
    });

    return NextResponse.json({
      ok: true,
      serverContext,
      report,
      cannotIncreaseRisk: true,
      cannotAutoApproveProposals: true,
      cannotBypassGovernance: true,
      safetyNotice: COMMAND_CENTER_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Command center status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

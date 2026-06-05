import { runCommandCenterAction } from "@/lib/command-center/run-actions";
import { COMMAND_CENTER_SAFETY_NOTICE } from "@/lib/command-center/types";
import type {
  CommandCenterActionRequest,
  CommandCenterReport,
} from "@/lib/command-center/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = CommandCenterActionRequest & {
  reportSnapshot?: CommandCenterReport | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const result = runCommandCenterAction(
      {
        action: body.action,
        operatorNote: body.operatorNote,
        proposalId: body.proposalId,
      },
      body.reportSnapshot ?? null,
    );

    return NextResponse.json(
      {
        ...result,
        cannotIncreaseRisk: true,
        cannotAutoApproveProposals: true,
        cannotBypassGovernance: true,
        safetyNotice: COMMAND_CENTER_SAFETY_NOTICE,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Command center action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

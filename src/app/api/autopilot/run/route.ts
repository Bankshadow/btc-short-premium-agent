import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { AUTOPILOT_SAFETY_NOTICE } from "@/lib/autopilot/config";
import type { AutopilotRunInput } from "@/lib/autopilot/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: AutopilotRunInput = {};
    try {
      body = (await request.json()) as AutopilotRunInput;
    } catch {
      /* empty */
    }
    const serverContext = await buildCommandCenterServerContext();
    const result = await runAutopilotCycle({
      ...body,
      serverContext: body.serverContext ?? serverContext,
    });
    return NextResponse.json({
      ok: true,
      result,
      cannotEnableLiveAutopilot: true,
      safetyNotice: AUTOPILOT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Autopilot run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

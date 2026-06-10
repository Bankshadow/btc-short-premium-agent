import { NextResponse } from "next/server";
import { enableKillSwitch } from "@/lib/operator/operator-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reason?: string; doubleConfirm?: boolean };
    const result = await enableKillSwitch({
      reason: body.reason ?? "Operator enabled kill switch.",
      doubleConfirm: body.doubleConfirm === true,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enable failed" },
      { status: 500 },
    );
  }
}

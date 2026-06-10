import { NextResponse } from "next/server";
import { setRiskMode } from "@/lib/operator/operator-actions";
import type { RiskMode } from "@/lib/operator/operator-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: RiskMode; doubleConfirm?: boolean };
    const result = await setRiskMode({
      mode: body.mode ?? "NORMAL",
      doubleConfirm: body.doubleConfirm === true,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Risk mode change failed" },
      { status: 500 },
    );
  }
}

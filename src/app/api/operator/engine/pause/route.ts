import { NextResponse } from "next/server";
import { pauseEngine } from "@/lib/operator/operator-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reason?: string; doubleConfirm?: boolean };
    const result = await pauseEngine({
      reason: body.reason ?? "Operator paused engine.",
      doubleConfirm: body.doubleConfirm === true,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Pause failed" }, { status: 500 });
  }
}

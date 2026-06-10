import { NextRequest, NextResponse } from "next/server";
import { reviewExecutionSafety } from "@/lib/execution/execution-safety-gate";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      previewId?: string;
      doubleConfirm?: boolean;
    };

    if (!body.previewId) {
      return NextResponse.json({ error: "previewId required" }, { status: 400 });
    }

    const result = await reviewExecutionSafety({
      previewId: body.previewId,
      doubleConfirm: Boolean(body.doubleConfirm),
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution review failed" },
      { status: 500 },
    );
  }
}

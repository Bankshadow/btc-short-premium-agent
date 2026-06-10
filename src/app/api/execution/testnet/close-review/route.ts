import { NextResponse } from "next/server";
import { reviewCloseSafety } from "@/lib/execution/close-safety-gate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      closePreviewId?: string;
      doubleConfirm?: boolean;
    };

    if (!body.closePreviewId) {
      return NextResponse.json({ error: "closePreviewId is required" }, { status: 400 });
    }

    const result = await reviewCloseSafety({
      closePreviewId: body.closePreviewId,
      doubleConfirm: body.doubleConfirm === true,
    });

    return NextResponse.json(result, { status: result.allowed ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Close review failed" },
      { status: 500 },
    );
  }
}

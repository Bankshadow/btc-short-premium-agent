import { NextResponse } from "next/server";
import { executeTestnetClose } from "@/lib/execution/execute-testnet-close";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      closePreviewId?: string;
      doubleConfirm?: boolean;
    };

    if (!body.closePreviewId) {
      return NextResponse.json({ error: "closePreviewId is required" }, { status: 400 });
    }

    if (body.doubleConfirm !== true) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          message: "doubleConfirm must be true.",
          blockers: [{ code: "DOUBLE_CONFIRM_REQUIRED", message: "Double confirmation required.", requiredAction: "Set doubleConfirm to true." }],
          orderId: null,
          positionClosed: false,
        },
        { status: 403 },
      );
    }

    const result = await executeTestnetClose({
      closePreviewId: body.closePreviewId,
      doubleConfirm: true,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Close failed" },
      { status: 500 },
    );
  }
}

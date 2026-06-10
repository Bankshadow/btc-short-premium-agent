import { NextResponse } from "next/server";
import { executeTestnetOrder } from "@/lib/execution/execute-testnet-order";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      previewId?: string;
      doubleConfirm?: boolean;
    };

    if (!body.previewId) {
      return NextResponse.json({ error: "previewId is required" }, { status: 400 });
    }

    const result = await executeTestnetOrder({
      previewId: body.previewId,
      doubleConfirm: Boolean(body.doubleConfirm),
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execute failed" },
      { status: 500 },
    );
  }
}

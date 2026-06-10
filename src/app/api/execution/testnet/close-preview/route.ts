import { NextResponse } from "next/server";
import { createClosePreview } from "@/lib/execution/create-close-preview";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tradeId?: string };
    if (!body.tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
    }

    const result = await createClosePreview({ tradeId: body.tradeId });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Close preview failed" },
      { status: 500 },
    );
  }
}

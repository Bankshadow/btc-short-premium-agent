import { NextResponse } from "next/server";
import { createLearningRecord } from "@/lib/learning/create-learning-record";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tradeId?: string };
    if (!body.tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
    }
    const result = await createLearningRecord({ tradeId: body.tradeId });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Learning create failed" },
      { status: 500 },
    );
  }
}

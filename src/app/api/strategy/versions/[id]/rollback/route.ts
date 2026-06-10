import { NextResponse } from "next/server";
import { rollbackStrategyVersion } from "@/lib/versioning/change-control";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { confirmedBy?: string };
    const result = await rollbackStrategyVersion(id, body.confirmedBy ?? "operator");
    return NextResponse.json({ ...result, sprint: "mvp-18" }, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rollback failed" },
      { status: 500 },
    );
  }
}

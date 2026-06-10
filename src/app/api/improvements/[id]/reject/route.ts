import { NextResponse } from "next/server";
import { rejectImprovement } from "@/lib/improvement/approval-flow";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const result = await rejectImprovement(id, body.reason ?? "Operator rejected.");
    return NextResponse.json({ ...result, sprint: "mvp-17" }, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reject failed" },
      { status: 500 },
    );
  }
}

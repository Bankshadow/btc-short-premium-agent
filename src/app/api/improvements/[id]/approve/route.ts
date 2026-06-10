import { NextResponse } from "next/server";
import { approveImprovement } from "@/lib/improvement/approval-flow";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await approveImprovement(id);
    return NextResponse.json({ ...result, sprint: "mvp-17" }, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { buildCoreTrace } from "@/lib/core/core-engine";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Trace id required." }, { status: 400 });
  }
  try {
    const trace = await buildCoreTrace(decodeURIComponent(id));
    if (!trace) {
      return NextResponse.json({ error: "No matching link id in journal." }, { status: 404 });
    }
    return NextResponse.json(trace);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trace failed" },
      { status: 500 },
    );
  }
}

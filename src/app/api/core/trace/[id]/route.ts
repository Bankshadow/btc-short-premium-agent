import { NextResponse } from "next/server";
import { readCoreEvents } from "@/lib/core/event-store";
import { buildTraceReport, detectTraceLinkKind } from "@/lib/core/trace/trace-builder";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Trace id required." }, { status: 400 });
  }
  const view = new URL(request.url).searchParams.get("view");
  try {
    const events = await readCoreEvents();
    const decoded = decodeURIComponent(id);
    const kind = detectTraceLinkKind(decoded, events);
    if (!kind) {
      return NextResponse.json({ error: "No matching link id in journal." }, { status: 404 });
    }
    const trace = buildTraceReport(events, kind, decoded, { evidenceView: view === "evidence" });
    return NextResponse.json(trace);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trace failed" },
      { status: 500 },
    );
  }
}

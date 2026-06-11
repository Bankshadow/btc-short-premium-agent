import { NextResponse } from "next/server";
import { buildEnrichedTradeProjection } from "@/lib/core/build-enriched-trade-projection";
import { readCoreEvents } from "@/lib/core/event-store";

export async function GET() {
  const events = await readCoreEvents();
  const projection = await buildEnrichedTradeProjection(events);
  return NextResponse.json({ ...projection, sprint: "slice-7" });
}

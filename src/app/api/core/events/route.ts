import { NextResponse } from "next/server";
import { readCoreEvents } from "@/lib/core/event-store";

export async function GET() {
  const events = await readCoreEvents();
  return NextResponse.json({ events, count: events.length, liveLocked: true });
}

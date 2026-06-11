import { NextResponse } from "next/server";
import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";

export async function GET() {
  const events = await readCoreEvents();
  const risk = buildProjectionById("risk", events);
  return NextResponse.json({ ...risk, liveLocked: true as const });
}

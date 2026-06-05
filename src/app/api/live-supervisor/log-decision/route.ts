import type { SupervisorJournalEntry } from "@/lib/live-trade-supervisor/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<
      SupervisorJournalEntry,
      "id" | "timestamp"
    >;

    const entry: SupervisorJournalEntry = {
      id: `sup-j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...body,
    };

    return NextResponse.json({
      ok: true,
      entry,
      clientMustPersist: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Log failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

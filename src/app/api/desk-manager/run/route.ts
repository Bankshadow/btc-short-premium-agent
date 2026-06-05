import { runDeskManagerCycle } from "@/lib/autonomous-desk-manager/run-manager-cycle";
import type { DeskManagerInput } from "@/lib/autonomous-desk-manager/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeskManagerInput;
    const result = await runDeskManagerCycle(body);
    return NextResponse.json({
      ok: true,
      result,
      clientMustPersist: Boolean(result.clientMustPersist),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Desk manager failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

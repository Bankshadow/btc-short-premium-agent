import { buildDbStatusReport } from "@/lib/db/warehouse-status";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const report = await buildDbStatusReport();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DB status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

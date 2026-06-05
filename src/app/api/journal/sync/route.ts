import { writeThroughDecisionLogs } from "@/lib/db/write-through";
import type { JournalSyncPayload } from "@/lib/journal/journal-cloud-sync";
import {
  fetchDecisionLogFromSupabase,
  upsertDecisionLogToSupabase,
} from "@/lib/supabase/decision-log-sync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      pulled: [],
      error: "Supabase not configured — journal stays in browser.",
    });
  }

  try {
    const pulled = await fetchDecisionLogFromSupabase();
    return NextResponse.json({ ok: true, synced: 0, pulled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ ok: false, synced: 0, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: JournalSyncPayload;
  try {
    body = (await request.json()) as JournalSyncPayload;
  } catch {
    return NextResponse.json({ ok: false, synced: 0, error: "Invalid JSON" }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      error: "Supabase not configured — entries kept locally only.",
    });
  }

  try {
    const warehouse = await writeThroughDecisionLogs(entries);
    let synced = warehouse.written;
    if (isSupabaseConfigured()) {
      synced = await upsertDecisionLogToSupabase(entries);
    }
    return NextResponse.json({
      ok: warehouse.ok || synced > 0,
      synced,
      warehouseOk: warehouse.ok,
      warehouseError: warehouse.errors[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upsert failed";
    return NextResponse.json({ ok: false, synced: 0, error: message }, { status: 500 });
  }
}

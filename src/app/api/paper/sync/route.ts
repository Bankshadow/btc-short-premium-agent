import type { PaperSyncPayload } from "@/lib/paper/paper-sync";
import {
  fetchOpenPaperOrdersFromSupabase,
  fetchPaperOrdersFromSupabase,
  upsertPaperOrdersToSupabase,
} from "@/lib/supabase/paper-orders";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      pulled: [],
      error: "Supabase not configured — local-only paper mode.",
    });
  }

  try {
    const pulled = await fetchPaperOrdersFromSupabase();
    const openOrders = pulled.filter((o) => o.status === "OPEN");
    return NextResponse.json({ ok: true, synced: 0, pulled, openOrders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ ok: false, synced: 0, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: PaperSyncPayload;
  try {
    body = (await request.json()) as PaperSyncPayload;
  } catch {
    return NextResponse.json({ ok: false, synced: 0, error: "Invalid JSON" }, { status: 400 });
  }

  const orders = body.orders ?? [];
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      error: "Supabase not configured — orders kept in browser only.",
    });
  }

  try {
    const synced = await upsertPaperOrdersToSupabase(orders);
    const openOrders = await fetchOpenPaperOrdersFromSupabase();
    return NextResponse.json({
      ok: true,
      synced,
      openOrders,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upsert failed";
    return NextResponse.json({ ok: false, synced: 0, error: message }, { status: 500 });
  }
}

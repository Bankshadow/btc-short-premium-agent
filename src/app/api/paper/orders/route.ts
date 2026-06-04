import {
  fetchOpenPaperOrdersFromSupabase,
  fetchPaperOrdersFromSupabase,
} from "@/lib/supabase/paper-orders";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

/** List paper orders — `?status=open` returns only OPEN positions. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const openOnly = searchParams.get("status") === "open";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      openOrders: [],
      orders: [],
      source: "local",
      message: "Supabase not configured — use browser storage or POST /api/paper/sync.",
    });
  }

  try {
    const orders = openOnly
      ? await fetchOpenPaperOrdersFromSupabase()
      : await fetchPaperOrdersFromSupabase();
    const openOrders = orders.filter((o) => o.status === "OPEN");
    return NextResponse.json({
      ok: true,
      openOrders,
      orders,
      source: "supabase",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json(
      { ok: false, openOrders: [], orders: [], error: message },
      { status: 500 },
    );
  }
}

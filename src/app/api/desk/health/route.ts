import { buildDeskHealth } from "@/lib/operator/desk-health";
import { fetchOpenPaperOrdersFromSupabase } from "@/lib/supabase/paper-orders";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let openPaperCount = 0;
  if (isSupabaseConfigured()) {
    try {
      const open = await fetchOpenPaperOrdersFromSupabase();
      openPaperCount = open.length;
    } catch {
      openPaperCount = 0;
    }
  }

  return NextResponse.json({
    ok: true,
    health: buildDeskHealth(null, { openPaperCount }),
  });
}

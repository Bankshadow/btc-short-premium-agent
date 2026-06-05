import {
  getBacktestResult,
  listBacktestResults,
} from "@/lib/historical-backtest";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const result = getBacktestResult(id);
      if (!result) {
        return NextResponse.json(
          { ok: false, error: "Backtest result not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, result });
    }

    const results = listBacktestResults();
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Results failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

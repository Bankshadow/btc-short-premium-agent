import { buildRegimeBrainReport } from "@/lib/market-regime-brain/build-regime-report";
import type { RegimeBrainInput } from "@/lib/market-regime-brain/types";
import type { RegimeHistoryEntry } from "@/lib/market-regime-brain/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brainInput: RegimeBrainInput;
      history?: RegimeHistoryEntry[];
      entries?: DecisionLogEntry[];
    };
    const report = buildRegimeBrainReport(body);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

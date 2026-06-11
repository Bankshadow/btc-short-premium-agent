import { NextResponse } from "next/server";
import { runJournalRepair } from "@/lib/journal/journal-repair";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
      tradeIds?: string[];
    };
    const report = await runJournalRepair({
      dryRun: body.dryRun ?? false,
      tradeIds: body.tradeIds,
    });
    return NextResponse.json(report, { status: report.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Journal repair failed" },
      { status: 500 },
    );
  }
}

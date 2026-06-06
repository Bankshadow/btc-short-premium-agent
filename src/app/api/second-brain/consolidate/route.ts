import { NextResponse } from "next/server";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { consolidateSecondBrain } from "@/lib/second-brain/consolidate";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 74 — manual second brain consolidation. */
export async function POST() {
  try {
    const [entries, learningRecords] = await Promise.all([
      loadServerAnalysisJournal().catch(() => []),
      loadLearningRecordsServer().catch(() => []),
    ]);
    const result = await consolidateSecondBrain({
      entries,
      learningRecords,
      force: true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Consolidate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

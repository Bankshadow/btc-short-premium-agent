import { NextResponse } from "next/server";
import { getAllLearningRecords, summarizeLearning } from "@/lib/learning/learning-store";

export async function GET() {
  try {
    const records = await getAllLearningRecords();
    return NextResponse.json({ records, summary: summarizeLearning(records), sprint: "mvp-7" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load learning records" },
      { status: 500 },
    );
  }
}

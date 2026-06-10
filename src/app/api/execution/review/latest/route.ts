import { NextResponse } from "next/server";
import { getLatestExecutionReview } from "@/lib/execution/execution-safety-gate";

export async function GET() {
  try {
    const review = await getLatestExecutionReview();
    return NextResponse.json({ review });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load review" },
      { status: 500 },
    );
  }
}

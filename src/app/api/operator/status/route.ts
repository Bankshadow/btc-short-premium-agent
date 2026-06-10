import { NextResponse } from "next/server";
import { getOperatorStatus } from "@/lib/operator/operator-actions";

export async function GET() {
  try {
    const status = await getOperatorStatus();
    return NextResponse.json({ ...status, sprint: "mvp-19" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load operator status" },
      { status: 500 },
    );
  }
}

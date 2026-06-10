import { NextResponse } from "next/server";
import { buildStrategyHealthView, calculateStrategyHealth } from "@/lib/strategy/strategy-health";

export async function GET() {
  try {
    const report = await buildStrategyHealthView();
    return NextResponse.json({ ...report, sprint: "mvp-10" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Strategy health failed" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const report = await calculateStrategyHealth();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Strategy health failed" },
      { status: 500 },
    );
  }
}

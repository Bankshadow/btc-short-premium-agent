import { NextResponse } from "next/server";
import { getLatestPortfolioRisk, evaluatePortfolioRisk } from "@/lib/portfolio-risk/portfolio-risk-manager";

export async function GET() {
  try {
    return NextResponse.json({ report: await getLatestPortfolioRisk(), sprint: "mvp-21" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json({ ok: true, report: await evaluatePortfolioRisk(), sprint: "mvp-21" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

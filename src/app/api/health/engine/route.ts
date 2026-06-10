import { NextResponse } from "next/server";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { appendEvent } from "@/lib/journal/journal-query";

export async function GET() {
  try {
    const report = await runEngineHealthCheck();
    return NextResponse.json({ ...report, sprint: "mvp-9" });
  } catch (err) {
    return NextResponse.json(
      { status: "WARNING", message: "Health check failed", issues: [], blocksExecution: false },
      { status: 200 },
    );
  }
}

export async function POST() {
  try {
    const report = await runEngineHealthCheck();
    await appendEvent({
      type: "ENGINE_HEALTH_CHECKED",
      environment: "testnet",
      payload: { status: report.status, issueCount: report.issues.length },
    });
    if (report.blocksExecution) {
      await appendEvent({
        type: "STATE_HEALTH_BLOCKED",
        environment: "testnet",
        payload: { issues: report.issues.map((i) => i.code) },
      });
    }
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Health check failed" },
      { status: 500 },
    );
  }
}

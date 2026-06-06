import { NextResponse } from "next/server";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
    const alert = await emitMissionAlert({
      kind: "automation_cycle",
      title: "Mission notification test",
      body: [
        `Autopilot: ${snapshot.automation.autoExecuteEnabled ? "fully automatic" : "semi-automatic"}`,
        `AI state: ${snapshot.aiStatus.state}`,
        `Equity: $${snapshot.currentEquity.toFixed(2)} (${snapshot.progressPct}%)`,
        `Trust: ${snapshot.trust.completedTrades}/${snapshot.trust.minRequired}`,
      ].join("\n"),
    });

    return NextResponse.json({
      ok: true,
      telegramConfigured: snapshot.notifications.telegramConfigured,
      alert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test notification failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

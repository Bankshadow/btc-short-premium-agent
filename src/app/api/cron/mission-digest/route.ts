import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
    const lastActivity = snapshot.recentActivity[0];

    const digest = [
      `Mission daily digest · ${new Date().toLocaleString()}`,
      `Equity: ${usd(snapshot.currentEquity)} (${snapshot.progressPct}% → $10k)`,
      `Trades: ${snapshot.closedTrades} closed · ${snapshot.openTrades} open · net ${usd(snapshot.netPnl)}`,
      `Trust: ${snapshot.trust.completedTrades}/${snapshot.trust.minRequired}${snapshot.trust.ready ? " ✓" : ""}`,
      `Autopilot: ${snapshot.automation.autoExecuteEnabled ? "auto" : "semi"} · last ${lastActivity?.status ?? "—"}`,
      snapshot.strategyHealth
        ? `Strategy: ${snapshot.strategyHealth.label} · ${snapshot.strategyHealth.status}`
        : null,
      snapshot.learningInsights.learnedCount > 0
        ? `Learning: ${snapshot.learningInsights.learnedCount} ingested · avg R ${snapshot.learningInsights.avgR ?? "—"}`
        : null,
      `AI: ${snapshot.aiStatus.state} · ${snapshot.lastVerdict ?? "—"}`,
      snapshot.risk.blocker ? `Blocker: ${snapshot.risk.blocker}` : null,
      snapshot.nextRecommendation,
    ]
      .filter(Boolean)
      .join("\n");

    const alert = await emitMissionAlert({
      kind: "cycle_complete",
      title: "Daily mission digest",
      body: digest,
    });

    return NextResponse.json({
      ok: true,
      test,
      digest,
      alert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission digest cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

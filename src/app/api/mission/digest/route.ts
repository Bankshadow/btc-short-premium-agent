import { NextResponse } from "next/server";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const send = searchParams.get("send") === "1";
    const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });

    const digest = [
      `Mission digest · ${new Date().toLocaleString()}`,
      `Equity: ${usd(snapshot.currentEquity)} (${snapshot.progressPct}% to $10k)`,
      `Trades: ${snapshot.closedTrades} closed · ${snapshot.openTrades} open · PnL ${usd(snapshot.netPnl)}`,
      `Trust: ${snapshot.trust.completedTrades}/${snapshot.trust.minRequired}`,
      `AI: ${snapshot.aiStatus.state} · ${snapshot.aiStatus.nextAction}`,
      snapshot.risk.blocker ? `Blocker: ${snapshot.risk.blocker}` : null,
      snapshot.nextRecommendation,
    ]
      .filter(Boolean)
      .join("\n");

    let alert: { sent: boolean; skipped?: string } | null = null;
    if (send) {
      alert = await emitMissionAlert({
        kind: "cycle_complete",
        title: "Daily mission digest",
        body: digest,
      });
    }

    return NextResponse.json({
      ok: true,
      digest,
      snapshot: {
        lastUpdatedAt: snapshot.lastUpdatedAt,
        progressPct: snapshot.progressPct,
        netPnl: snapshot.netPnl,
      },
      alert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { runRiskReplayForTradeId } from "@/lib/risk-replay";
import { appendRiskReplayReview } from "@/lib/live-evidence/risk-replay-review-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  tradeId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.tradeId) {
      return NextResponse.json(
        { ok: false, error: "tradeId required" },
        { status: 400 },
      );
    }

    const report = await runRiskReplayForTradeId(body.tradeId);
    if (!report) {
      return NextResponse.json(
        { ok: false, error: "Trade not found for replay" },
        { status: 404 },
      );
    }

    await appendRiskReplayReview({
      reviewedAt: new Date().toISOString(),
      tradeId: body.tradeId,
      source: "RISK_REPLAY_RUN",
    });

    return NextResponse.json({
      ok: true,
      report,
      safety: {
        simulationOnly: true,
        tradeHistoryImmutable: true,
        autoLiveRiskIncreaseDisabled: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Risk replay run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

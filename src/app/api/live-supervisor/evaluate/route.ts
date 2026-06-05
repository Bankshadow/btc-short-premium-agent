import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { enrichRealTimeRiskInput, evaluateRealTimeRisk } from "@/lib/real-time-risk";
import { runLiveTradeSupervisor } from "@/lib/live-trade-supervisor/run-supervisor";
import type { LiveSupervisorInput } from "@/lib/live-trade-supervisor/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LiveSupervisorInput & {
      fetchExchange?: boolean;
    };

    let exchangeStatus = body.exchangeStatus ?? null;
    if (body.fetchExchange !== false) {
      try {
        exchangeStatus = await buildExchangeStatus();
      } catch {
        exchangeStatus = body.exchangeStatus ?? null;
      }
    }

    let realTimeRisk = body.realTimeRisk ?? null;
    if (!realTimeRisk) {
      const riskInput = await enrichRealTimeRiskInput({
        entries: body.entries ?? [],
        orders: [],
        liveTrades: body.openTrades,
        governance: body.governance ?? undefined,
        regimeBrain: body.regimeBrain,
        riskBudget: body.riskBudget ?? null,
        emergencyStopActive: body.emergencyStopActive,
        exchangePositions: [
          ...(exchangeStatus?.linearPositions ?? []),
          ...(exchangeStatus?.optionPositions ?? []),
        ],
        openOrders: [
          ...(exchangeStatus?.openLinearOrders ?? []),
          ...(exchangeStatus?.openOptionOrders ?? []),
        ],
        wallet: exchangeStatus?.wallet ?? null,
      });
      realTimeRisk = evaluateRealTimeRisk(riskInput);
    }

    const report = runLiveTradeSupervisor({
      ...body,
      exchangeStatus,
      realTimeRisk,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

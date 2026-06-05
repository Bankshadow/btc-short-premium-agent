import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import { saveServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import type { UnifiedPortfolioInput } from "@/lib/portfolio/unified-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alias endpoint: POST /api/portfolio/paper/sync */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UnifiedPortfolioInput & {
      persist?: boolean;
    };

    if (!body.orders?.length && !body.perpPositions?.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "orders or perpPositions required for unified paper sync.",
        },
        { status: 400 },
      );
    }

    const snapshot = buildUnifiedPortfolioSnapshot({
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions ?? [],
      riskProfile: body.riskProfile ?? "balanced",
      baseEquityUsd: body.baseEquityUsd,
    });

    if (body.persist !== false) {
      await saveServerUnifiedPortfolio(snapshot);
    }

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Portfolio sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    method: "POST",
    body: {
      entries: "DecisionLogEntry[]",
      orders: "PaperOrder[]",
      perpPositions: "PerpPaperPosition[]",
      riskProfile: "balanced | aggressive",
      persist: "boolean (default true)",
    },
  });
}

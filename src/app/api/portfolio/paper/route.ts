import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import {
  loadServerUnifiedPortfolio,
  saveServerUnifiedPortfolio,
} from "@/lib/portfolio/unified-paper-server-store";
import type { UnifiedPortfolioInput } from "@/lib/portfolio/unified-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SyncBody = UnifiedPortfolioInput & {
  persist?: boolean;
};

async function buildFromBody(body: SyncBody | null) {
  if (!body?.orders?.length && !body?.perpPositions?.length) {
    return null;
  }
  return buildUnifiedPortfolioSnapshot({
    entries: body.entries ?? [],
    orders: body.orders ?? [],
    perpPositions: body.perpPositions ?? [],
    riskProfile: body.riskProfile ?? "balanced",
    baseEquityUsd: body.baseEquityUsd,
  });
}

export async function GET() {
  try {
    const cached = await loadServerUnifiedPortfolio();
    if (cached) {
      return NextResponse.json({
        ok: true,
        source: "server_cache",
        snapshot: cached,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "empty",
      snapshot: buildUnifiedPortfolioSnapshot(),
      hint: "POST /api/portfolio/paper/sync with entries, orders, and perpPositions from client.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Portfolio load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncBody;
    const snapshot = await buildFromBody(body);

    if (!snapshot) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Provide orders and/or perpPositions in POST body to build unified snapshot.",
        },
        { status: 400 },
      );
    }

    if (body.persist !== false) {
      await saveServerUnifiedPortfolio(snapshot);
    }

    return NextResponse.json({
      ok: true,
      source: "computed",
      syncedAt: new Date().toISOString(),
      snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Portfolio sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

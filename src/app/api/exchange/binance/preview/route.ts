import {
  buildOrderPreview,
  findPendingTestnetPreview,
  getStoredPreview,
} from "@/lib/exchange/binance";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import type { BinanceOrderPreviewInput } from "@/lib/exchange/binance/binance-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const previewId = searchParams.get("previewId");
    const latestDecisionLogId = searchParams.get("decisionLogId");

    const preview = previewId
      ? await getStoredPreview(previewId)
      : await findPendingTestnetPreview(latestDecisionLogId);

    if (!preview) {
      return NextResponse.json(
        { ok: false, error: "No active preview found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview lookup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const productionBlock = blockBinanceProductionOrder();
    if (productionBlock) {
      return NextResponse.json(
        { ok: false, error: productionBlock, productionBlocked: true },
        { status: 422 },
      );
    }

    const body = (await request.json()) as BinanceOrderPreviewInput;
    if (!body.symbol || !body.side || !body.notionalUsd) {
      return NextResponse.json(
        { error: "symbol, side, and notionalUsd required" },
        { status: 400 },
      );
    }

    const preview = await buildOrderPreview({
      source: body.source ?? "manual_test",
      symbol: body.symbol,
      side: body.side,
      notionalUsd: body.notionalUsd,
      reason: body.reason ?? "testnet preview",
      decisionLogId: body.decisionLogId ?? null,
    });

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

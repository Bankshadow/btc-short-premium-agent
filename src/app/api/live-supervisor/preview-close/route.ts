import { buildSupervisorClosePreview } from "@/lib/live-trade-supervisor/build-close-preview";
import type { ClosePreviewRequest } from "@/lib/live-trade-supervisor/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      trade: LiveTradeJournalEntry;
      request: ClosePreviewRequest;
      markPrice: number;
    };

    const preview = buildSupervisorClosePreview({
      trade: body.trade,
      request: body.request,
      markPrice: body.markPrice,
    });

    if (!preview) {
      return NextResponse.json(
        { ok: false, error: "Cannot build close preview — missing qty." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      preview,
      requiresHumanApproval: true,
      cannotIncreaseExposure: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

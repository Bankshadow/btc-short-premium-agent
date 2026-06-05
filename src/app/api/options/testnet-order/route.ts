import type { OptionsOrderPreview, OptionsPreviewJournalEntry } from "@/lib/options-execution/types";
import { blockProductionOptionsOrder } from "@/lib/options-execution/testnet-gates";
import { simulateTestnetOptionsOrder } from "@/lib/options-execution/testnet-order";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  preview: OptionsOrderPreview;
  journal?: OptionsPreviewJournalEntry[];
};

export async function POST(request: Request) {
  try {
    const liveBlock = blockProductionOptionsOrder();
    if (liveBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: liveBlock,
          realOrderSent: false,
          liveImplemented: false,
        },
        { status: 422 },
      );
    }

    const body = (await request.json()) as Body;
    if (!body.preview?.previewId) {
      return NextResponse.json({ error: "preview required" }, { status: 400 });
    }

    const result = simulateTestnetOptionsOrder(
      body.preview,
      body.journal ?? [],
    );

    return NextResponse.json(
      {
        ...result,
        clientMustPersistJournal: true,
        realOrderSent: false,
        liveImplemented: false,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Testnet order failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

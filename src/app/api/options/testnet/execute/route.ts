import { placeOptionsTestnetOrder } from "@/lib/options-execution/options-testnet-execution";
import { blockProductionOptionsOrder } from "@/lib/options-execution/testnet-gates";
import type {
  OptionsOrderPreview,
  OptionsPreviewJournalEntry,
} from "@/lib/options-execution/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  preview: OptionsOrderPreview;
  previewJournal?: OptionsPreviewJournalEntry[];
  operatorApproval?: boolean;
  operatorNote?: string;
};

export async function POST(request: Request) {
  try {
    const productionBlock = blockProductionOptionsOrder();
    if (productionBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: productionBlock,
          productionBlocked: true,
          liveImplemented: false,
        },
        { status: 422 },
      );
    }

    const body = (await request.json()) as Body;
    if (!body.preview?.previewId) {
      return NextResponse.json({ error: "preview required" }, { status: 400 });
    }

    const result = await placeOptionsTestnetOrder({
      preview: body.preview,
      previewJournal: body.previewJournal ?? [],
      operatorApproval: body.operatorApproval,
      operatorNote: body.operatorNote,
    });

    return NextResponse.json(
      {
        ...result,
        clientMustPersistJournal: true,
        liveImplemented: false,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Testnet execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

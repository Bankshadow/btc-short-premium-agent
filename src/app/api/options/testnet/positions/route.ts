import { fetchOptionsTestnetPositions } from "@/lib/options-execution/options-testnet-execution";
import { blockProductionOptionsOrder } from "@/lib/options-execution/testnet-gates";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const productionBlock = blockProductionOptionsOrder();
    if (productionBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: productionBlock,
          productionBlocked: true,
          positions: [],
        },
        { status: 422 },
      );
    }

    const result = await fetchOptionsTestnetPositions();
    return NextResponse.json(
      {
        ...result,
        testnetOnly: true,
        productionBlocked: true,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fetch testnet positions failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

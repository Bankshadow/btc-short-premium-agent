import { fetchOptionsTestnetOrders } from "@/lib/options-execution/options-testnet-execution";
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
          orders: [],
        },
        { status: 422 },
      );
    }

    const result = await fetchOptionsTestnetOrders();
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
      error instanceof Error ? error.message : "Fetch testnet orders failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

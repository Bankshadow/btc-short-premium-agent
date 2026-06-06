import { getAccount, getBalance } from "@/lib/exchange/binance";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const productionBlock = blockBinanceProductionOrder();
    if (productionBlock) {
      return NextResponse.json(
        { ok: false, error: productionBlock, productionBlocked: true },
        { status: 422 },
      );
    }

    const [account, balances] = await Promise.all([getAccount(), getBalance()]);
    return NextResponse.json({ ok: true, account, balances });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

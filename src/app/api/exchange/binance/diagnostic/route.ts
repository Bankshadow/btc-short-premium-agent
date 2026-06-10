import { NextResponse } from "next/server";
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import { resolveBinanceTestnetDiagnosticFromStatus } from "@/lib/testnet-engine-activation/build-binance-testnet-diagnostic";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBinanceStatus().catch(() => null);
    const diagnostic = resolveBinanceTestnetDiagnosticFromStatus(status);
    return NextResponse.json({ ok: true, diagnostic, liveTradingLocked: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Binance diagnostic failed",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { resolveBinanceTestnetDiagnosticFromStatus } from "@/lib/testnet-engine-activation/build-binance-testnet-diagnostic";
import { probeBinanceStatus } from "@/lib/testnet-engine-activation/activation-probes";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  try {
    const status = await probeBinanceStatus();
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

import { NextResponse } from "next/server";
import { runMultiAssetScan } from "@/lib/multi-asset/multi-asset-scanner";
import { runMultiTimeframeScan } from "@/lib/multi-asset/multi-timeframe-scanner";
import {
  SUPPORTED_PERP_ASSETS,
  type PerpAssetConfig,
} from "@/lib/multi-asset/asset-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleScan(
  symbols?: string[],
  mode: "legacy" | "multitimeframe" = "legacy",
) {
  let assets: PerpAssetConfig[] = SUPPORTED_PERP_ASSETS;
  if (symbols && symbols.length > 0) {
    const set = new Set(symbols.map((s) => s.toUpperCase()));
    assets = SUPPORTED_PERP_ASSETS.filter(
      (asset) => set.has(asset.symbol) || set.has(asset.id),
    );
    if (assets.length === 0) assets = SUPPORTED_PERP_ASSETS;
  }

  const result =
    mode === "multitimeframe"
      ? await runMultiTimeframeScan(assets)
      : await runMultiAssetScan(assets);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get("mode");
    return await handleScan(
      undefined,
      mode === "multitimeframe" ? "multitimeframe" : "legacy",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Multi-asset scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let symbols: string[] | undefined;
    try {
      const body = (await request.json()) as {
        symbols?: string[];
        mode?: "legacy" | "multitimeframe";
      };
      symbols = Array.isArray(body?.symbols) ? body.symbols : undefined;
      return await handleScan(symbols, body?.mode ?? "legacy");
    } catch {
      symbols = undefined;
    }
    return await handleScan(symbols);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Multi-asset scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

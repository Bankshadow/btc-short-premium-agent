import { buildTerminalBundle } from "@/lib/terminal/terminal-projection-builder";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const bundle = await buildTerminalBundle();
    return NextResponse.json({
      ok: true,
      sprint: "mvp-22-terminal",
      paperOnly: true,
      realTradingEnabled: false,
      liveLocked: true,
      bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Terminal bundle failed" },
      { status: 500 },
    );
  }
}

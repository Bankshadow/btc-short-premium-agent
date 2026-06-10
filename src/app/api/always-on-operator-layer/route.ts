import { NextResponse } from "next/server";
import { runOperatorLayerTick, loadOperatorLayerSnapshot } from "@/lib/always-on-operator-layer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await loadOperatorLayerSnapshot();
    return NextResponse.json({ ok: true, alwaysOnOperatorLayer: snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Operator layer snapshot failed",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const snapshot = await runOperatorLayerTick({ trigger: "manual" });
    return NextResponse.json({ ok: true, alwaysOnOperatorLayer: snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Operator layer tick failed",
      },
      { status: 500 },
    );
  }
}

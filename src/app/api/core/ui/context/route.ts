import { NextResponse } from "next/server";
import { buildDashboardUiContext } from "@/lib/core/ui-context";

export async function GET() {
  try {
    return NextResponse.json(await buildDashboardUiContext());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UI context failed" },
      { status: 500 },
    );
  }
}

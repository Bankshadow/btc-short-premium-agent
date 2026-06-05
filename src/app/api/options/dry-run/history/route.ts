import { mergeDryRunHistory } from "@/lib/options-dry-run/dry-run-store";
import { OPTIONS_DRY_RUN_SAFETY_NOTICE } from "@/lib/options-dry-run/types";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const history = await mergeDryRunHistory();
    return NextResponse.json({
      ok: true,
      count: history.length,
      history,
      dryRunOnly: true,
      safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dry-run history failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let clientHistory: OptionsDryRunResult[] = [];
    try {
      const body = (await request.json()) as { history?: OptionsDryRunResult[] };
      clientHistory = body.history ?? [];
    } catch {
      /* empty */
    }
    const history = await mergeDryRunHistory(clientHistory);
    return NextResponse.json({
      ok: true,
      count: history.length,
      history,
      dryRunOnly: true,
      safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dry-run history failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

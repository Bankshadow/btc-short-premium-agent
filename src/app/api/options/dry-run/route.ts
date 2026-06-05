import {
  runOptionsDryRun,
  OPTIONS_DRY_RUN_SAFETY_NOTICE,
} from "@/lib/options-dry-run";
import type { OptionsDryRunInput } from "@/lib/options-dry-run/types";
import { appendServerDryRunResult } from "@/lib/options-dry-run/dry-run-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OptionsDryRunInput;
    const result = await runOptionsDryRun(body);
    await appendServerDryRunResult(result);

    return NextResponse.json({
      ok: true,
      result,
      dryRunOnly: true,
      noRealOrders: true,
      cannotEnableLive: true,
      safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Options dry-run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

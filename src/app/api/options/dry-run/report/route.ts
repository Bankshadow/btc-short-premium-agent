import { buildOptionsDryRunPerformanceReport } from "@/lib/options-dry-run/build-performance-report";
import { mergeDryRunHistory } from "@/lib/options-dry-run/dry-run-store";
import { OPTIONS_DRY_RUN_SAFETY_NOTICE } from "@/lib/options-dry-run/types";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  history?: OptionsDryRunResult[];
  paperOrders?: PaperOrder[];
};

export async function GET() {
  try {
    const history = await mergeDryRunHistory();
    const report = buildOptionsDryRunPerformanceReport({ history });
    return NextResponse.json({
      ok: true,
      report,
      cannotEnableLive: true,
      safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dry-run report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }
    const history = await mergeDryRunHistory(body.history);
    const report = buildOptionsDryRunPerformanceReport({
      history,
      paperOrders: body.paperOrders,
    });
    return NextResponse.json({
      ok: true,
      report,
      cannotEnableLive: true,
      safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dry-run report failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

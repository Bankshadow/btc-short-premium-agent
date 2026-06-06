import { NextResponse } from "next/server";
import { promoteQuantImport } from "@/lib/quant-strategy-importer/promote-import";
import { QUANT_IMPORT_SAFETY_NOTICE } from "@/lib/quant-strategy-importer/types";
import type { PromoteImportInput } from "@/lib/quant-strategy-importer/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 66 — human-approved status promotion (no execution). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromoteImportInput;
    const result = await promoteQuantImport(body);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.message,
          executionBlocked: true,
          safetyNotice: QUANT_IMPORT_SAFETY_NOTICE,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...result,
      cannotExecuteOrders: true,
      cannotChangeLiveSettings: true,
      safetyNotice: QUANT_IMPORT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Promote import failed";
    return NextResponse.json(
      { ok: false, error: message, executionBlocked: true },
      { status: 500 },
    );
  }
}

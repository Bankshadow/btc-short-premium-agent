import { NextResponse } from "next/server";
import { runEvidenceValidation } from "@/lib/evidence/evidence-progress";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tradeId?: string;
      validateAll?: boolean;
    };
    const result = await runEvidenceValidation({
      tradeId: body.tradeId,
      validateAll: body.validateAll ?? !body.tradeId,
      writeEvents: true,
    });
    return NextResponse.json({
      ok: true,
      validationId: result.validationId,
      progress: result.progress,
      validated: result.validated,
      rejected: result.rejected,
      eventsWritten: result.eventsWritten,
      liveLocked: true,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Evidence validation failed" },
      { status: 500 },
    );
  }
}

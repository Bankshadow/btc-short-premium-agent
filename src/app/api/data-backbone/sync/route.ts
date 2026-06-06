import { pushWarehouseMigrateLocal } from "@/lib/db/client-warehouse-sync";
import type { DeskBackboneRecord } from "@/lib/data-backbone/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: { record?: DeskBackboneRecord } = {};
    try {
      body = (await request.json()) as { record?: DeskBackboneRecord };
    } catch {
      /* empty */
    }

    const result = await pushWarehouseMigrateLocal(
      body.record
        ? {
            learningReports: [
              {
                type: "desk_backbone",
                recordedAt: body.record.lastWriteAt,
                payload: body.record,
              },
            ],
          }
        : undefined,
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Backbone sync failed" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, result: result.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backbone sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { migrateLocalStorageToWarehouse } from "@/lib/db/migrate-local";
import { WAREHOUSE_SAFETY_NOTICE } from "@/lib/db/types";
import type { LocalMigrationPayload } from "@/lib/db/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = LocalMigrationPayload & {
  analyzePayload?: { data: AnalyzeApiResponse; entryId: string };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const result = await migrateLocalStorageToWarehouse(body);
    return NextResponse.json({
      ok: result.errors.length === 0,
      result,
      localStoragePreserved: true,
      safetyNotice: WAREHOUSE_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

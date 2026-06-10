import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Deprecated — use /api/cron/tick as the single automation spine. */
export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  return NextResponse.json({
    ok: true,
    test,
    skipped: true,
    reason:
      "Background worker cron deprecated — /api/cron/tick runs automation and operator layer.",
    redirectTo: "/api/cron/tick",
  });
}

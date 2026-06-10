import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { runCronTick } from "@/lib/automation-control-plane/run-cron-tick";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Called by GitHub Actions / external scheduler — runs automation only when due. */
export async function GET(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const tick = await runCronTick({ force });
    return NextResponse.json({
      ok: tick.ok,
      test,
      tick,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

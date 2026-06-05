import { buildDeskManagerStatus } from "@/lib/autonomous-desk-manager/build-status";
import { DEFAULT_DESK_MANAGER_SETTINGS } from "@/lib/autonomous-desk-manager/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = buildDeskManagerStatus({
    settings: DEFAULT_DESK_MANAGER_SETTINGS,
    lastRun: null,
  });
  return NextResponse.json({
    ok: true,
    status,
    note: "Full status with pending actions requires client localStorage — use dashboard for live state.",
  });
}

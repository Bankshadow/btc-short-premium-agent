import { NextResponse } from "next/server";
import { hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import { getKillSwitchState } from "@/lib/operator/kill-switch";

export async function GET() {
  await hydrateOperatorGateState();
  const killSwitch = getKillSwitchState();
  return NextResponse.json({
    ...killSwitch,
    deprecated: true,
    useInstead: "/api/operator/status",
    sprint: "mvp-19",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated — use POST /api/operator/kill-switch/enable or /disable with doubleConfirm.",
      useInstead: "/api/operator/kill-switch/enable",
    },
    { status: 410 },
  );
}

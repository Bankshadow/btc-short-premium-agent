import { HARD_RULE_LABELS } from "@/lib/governance/hard-rule-lock";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 14,
    analysisOnly: true,
    roles: ["VIEWER", "OPERATOR", "RISK_MANAGER", "ADMIN"],
    hardRules: Object.entries(HARD_RULE_LABELS).map(([id, label]) => ({
      id,
      label,
      overridable: false,
    })),
    killSwitchActions: [
      "pause_analysis",
      "pause_paper_auto_open",
      "disable_aggressive_mode",
      "disable_alerts",
      "safe_mode",
    ],
    clientHint: "Open /governance in the browser for full controls and logs.",
  });
}

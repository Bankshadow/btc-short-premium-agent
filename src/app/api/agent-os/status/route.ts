import { NextResponse } from "next/server";
import { AGENT_OS_SAFETY_NOTICE } from "@/lib/agent-os/types";
import { buildAgentOsDashboardState } from "@/lib/agent-os/build-agent-os-state";
import { evaluateAllPermissions } from "@/lib/agent-os/permission-matrix";
import { resolveAgentOsMode } from "@/lib/agent-os/resolve-mode";
import { loadPermissionAudit } from "@/lib/agent-os/audit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 71 — agent OS mode and dashboard state. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testnetConnected = searchParams.get("testnetConnected") === "true";
    const paperAutopilot = searchParams.get("paperAutopilot") === "true";
    const observeOnly = searchParams.get("observeOnly") === "true";
    const testnetAuto = searchParams.get("testnetAuto") === "true";
    const goalProgressPct = Number(searchParams.get("goalProgressPct") ?? "NaN");

    const modeInput = {
      observeOnly,
      autopilotEnabled: !observeOnly,
      paperAutopilotEnabled: paperAutopilot,
      testnetConnected,
      automationEnabled: testnetConnected,
      testnetAllowAllSafe: testnetAuto,
      testnetAllowAllExplicitlyEnabled: testnetAuto,
    };

    const mode = resolveAgentOsMode(modeInput);
    const state = buildAgentOsDashboardState({
      ...modeInput,
      goalProgressPct: Number.isFinite(goalProgressPct) ? goalProgressPct : null,
      nextAction: testnetConnected
        ? "Monitor testnet positions — execute asks permission."
        : "Run AI analysis cycle.",
    });

    const matrix = evaluateAllPermissions({ mode });
    const recentAudit = await loadPermissionAudit(10);

    return NextResponse.json({
      ok: true,
      mvp: 71,
      liveLocked: true,
      neverAutoExecuteLive: true,
      safetyNotice: AGENT_OS_SAFETY_NOTICE,
      mode,
      state,
      matrix,
      recentAudit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent OS status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

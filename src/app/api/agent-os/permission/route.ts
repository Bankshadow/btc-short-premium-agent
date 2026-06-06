import { NextResponse } from "next/server";
import { AGENT_OS_SAFETY_NOTICE } from "@/lib/agent-os/types";
import { appendPermissionAuditEvent } from "@/lib/agent-os/audit-store";
import { evaluatePermission } from "@/lib/agent-os/permission-matrix";
import { resolveAgentOsMode } from "@/lib/agent-os/resolve-mode";
import type { AgentOsAction, AgentOsModeInput } from "@/lib/agent-os/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 71 — evaluate whether an action is allowed in current agent OS mode. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: AgentOsAction;
      modeInput?: AgentOsModeInput;
      testnetTradesToday?: number;
      maxAutoTestnetTradesPerDay?: number;
      sessionApproved?: boolean;
      onceApproved?: boolean;
      actor?: string;
      linkedTradeId?: string | null;
      linkedDecisionId?: string | null;
    };

    if (!body.action) {
      return NextResponse.json({ ok: false, error: "action required" }, { status: 400 });
    }

    const mode = resolveAgentOsMode(body.modeInput ?? {});
    const result = evaluatePermission(body.action, {
      mode,
      testnetTradesToday: body.testnetTradesToday,
      maxAutoTestnetTradesPerDay: body.maxAutoTestnetTradesPerDay,
      sessionApproved: body.sessionApproved,
      onceApproved: body.onceApproved,
    });

    return NextResponse.json({
      ok: true,
      mvp: 71,
      liveLocked: true,
      mode,
      result,
      safetyNotice: AGENT_OS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Permission check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** MVP 71 — record a permission decision (approve/deny). */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: AgentOsAction;
      approved?: boolean;
      actor?: string;
      reason?: string;
      approvalScope?: "once" | "session" | "denied";
      modeInput?: AgentOsModeInput;
      linkedTradeId?: string | null;
      linkedDecisionId?: string | null;
    };

    if (!body.action || body.approved === undefined) {
      return NextResponse.json(
        { ok: false, error: "action and approved required" },
        { status: 400 },
      );
    }

    const mode = resolveAgentOsMode(body.modeInput ?? {});
    const event = await appendPermissionAuditEvent({
      action: body.action,
      approved: body.approved,
      actor: body.actor ?? "operator",
      reason: body.reason ?? (body.approved ? "Approved" : "Denied"),
      linkedTradeId: body.linkedTradeId,
      linkedDecisionId: body.linkedDecisionId,
      approvalScope: body.approvalScope ?? (body.approved ? "once" : "denied"),
      mode,
    });

    return NextResponse.json({
      ok: true,
      mvp: 71,
      event,
      liveLocked: true,
      safetyNotice: AGENT_OS_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit write failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

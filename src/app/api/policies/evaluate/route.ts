import { buildPolicyInput, evaluatePolicy } from "@/lib/policy-engine";
import { appendPolicyDecision } from "@/lib/policy-engine/audit-store";
import type { PolicyActionType } from "@/lib/policy-engine/types";
import { parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: PolicyActionType;
      environmentMode?: string;
      latestAnalysis?: unknown;
      governance?: unknown;
      commandCenter?: unknown;
      liveReadiness?: unknown;
      entries?: unknown[];
      orders?: unknown[];
      riskProfile?: string;
      backboneHealthy?: boolean;
      auditAvailable?: boolean;
      operatorApproval?: boolean;
      doubleConfirm?: boolean;
    };

    if (!body.action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const wsCtx = parseApiWorkspaceContext(request, body as Record<string, unknown>);
    const policyInput = buildPolicyInput({
      workspaceId: wsCtx.workspaceId ?? "server-default",
      userRole: wsCtx.role ?? "TRADER",
      environmentMode: body.environmentMode ?? "PAPER",
      action: body.action,
      latestAnalysis: body.latestAnalysis as never,
      governance: body.governance as never,
      commandCenter: body.commandCenter as never,
      liveReadiness: body.liveReadiness as never,
      entries: body.entries as never,
      orders: body.orders as never,
      riskProfile: (body.riskProfile as never) ?? "balanced",
      backboneHealthy: body.backboneHealthy,
      auditAvailable: body.auditAvailable,
      operatorApproval: body.operatorApproval,
      doubleConfirm: body.doubleConfirm,
    });

    const result = evaluatePolicy(policyInput);
    await appendPolicyDecision(result, wsCtx.role ?? "TRADER");

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy evaluation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

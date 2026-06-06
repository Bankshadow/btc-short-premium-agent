import { applyAdaptationProposal } from "@/lib/strategy-adaptation/apply-proposal";
import type {
  AdaptationApplyInput,
  StrategyAdaptationProposal,
} from "@/lib/strategy-adaptation/types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import { buildPolicyInput } from "@/lib/policy-engine";
import { enforcePolicy } from "@/lib/policy-engine/enforce";
import { enforceApiPermission, parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = AdaptationApplyInput;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.proposal?.proposalId || !body.action) {
      return NextResponse.json(
        { ok: false, error: "proposal and action required." },
        { status: 400 },
      );
    }

    if (body.action === "approve" || body.action === "apply") {
      const wsCtx = parseApiWorkspaceContext(request, body as unknown as Record<string, unknown>);
      if (wsCtx.workspaceId) {
        const perm = enforceApiPermission(wsCtx, "canApproveStrategyChanges");
        if (!perm.ok) {
          return NextResponse.json({ ok: false, error: perm.error }, { status: perm.status });
        }
      }
      const policy = enforcePolicy(
        buildPolicyInput({
          workspaceId: wsCtx.workspaceId ?? "server-default",
          userRole: wsCtx.role ?? "TRADER",
          environmentMode:
            (body as unknown as Record<string, unknown>).environmentMode as string ?? "PAPER",
          action: "APPROVE_STRATEGY_CHANGE",
          governance: (body as unknown as Record<string, unknown>).governance as never,
        }),
      );
      if (!policy.ok) {
        return NextResponse.json(
          { ok: false, error: policy.error, policy: policy.result },
          { status: policy.status },
        );
      }
    }

    const result = applyAdaptationProposal({
      proposalId: body.proposalId,
      action: body.action,
      operatorNote: body.operatorNote,
      editedReason: body.editedReason,
      proposal: body.proposal as StrategyAdaptationProposal,
      registry: body.registry ?? { strategies: [] as StrategySkill[] },
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json({
      ...result,
      autoApply: false,
      clientMustPersist: true,
      safetyNotice:
        "Apply registry patch in browser via proposal-store — server does not auto-modify registry.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Adaptation apply failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

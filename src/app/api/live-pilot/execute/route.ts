import { assertLiveWriteHealthy } from "@/lib/db/write-health";
import { writeThroughLiveTrades } from "@/lib/db/write-through";
import { executePilotPerpOrder } from "@/lib/live-pilot/pilot-execution";
import type { PilotExecuteInput } from "@/lib/live-pilot/pilot-execution";
import { enforcePolicy } from "@/lib/policy-engine/enforce";
import { buildPolicyInputWithObservability } from "@/lib/observability/policy-context";
import { enforceApiPermission, parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PilotExecuteInput;

    if (!body.signal?.symbol || !body.confirmToken || !body.confirmExpiresAt) {
      return NextResponse.json(
        { error: "Missing signal, confirmToken, or confirmExpiresAt" },
        { status: 400 },
      );
    }

    if (body.signal.hasOptions) {
      return NextResponse.json(
        { error: "BTC options live is not available." },
        { status: 422 },
      );
    }

    if (!body.operatorApproval) {
      return NextResponse.json(
        { error: "operatorApproval must be true." },
        { status: 422 },
      );
    }

    const wsCtx = parseApiWorkspaceContext(request, body as unknown as Record<string, unknown>);
    if (wsCtx.workspaceId) {
      const perm = enforceApiPermission(wsCtx, "canApproveLiveTrade");
      if (!perm.ok) {
        return NextResponse.json({ error: perm.error }, { status: perm.status });
      }
    }

    const policyBody = body as PilotExecuteInput & Record<string, unknown>;
    const policy = enforcePolicy(
      await buildPolicyInputWithObservability({
        workspaceId: wsCtx.workspaceId ?? "server-default",
        userRole: wsCtx.role ?? "TRADER",
        environmentMode: (policyBody.environmentMode as string) ?? "LIVE_ENABLED",
        action: "EXECUTE_LIVE_PERP",
        governance: body.governance,
        entries: body.entries,
        orders: body.orders,
        riskProfile:
          (policyBody.riskProfile as import("@/lib/desk/desk-risk-policy").DeskRiskProfile) ??
          "balanced",
        operatorApproval: body.operatorApproval,
        doubleConfirm: Boolean(body.confirmToken && body.confirmExpiresAt),
        auditAvailable: true,
        backboneHealthy: true,
        commandCenter: policyBody.commandCenter as never,
        liveReadiness: policyBody.liveReadiness as never,
        latestAnalysis: policyBody.latestAnalysis as never,
      }),
    );
    if (!policy.ok) {
      return NextResponse.json(
        { ok: false, error: policy.error, policy: policy.result },
        { status: policy.status },
      );
    }

    const writeHealth = await assertLiveWriteHealthy();
    if (!writeHealth.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: writeHealth.reason,
          warehouseBlocked: true,
        },
        { status: 422 },
      );
    }

    const result = await executePilotPerpOrder(body);

    if (result.journalEntry) {
      const wh = await writeThroughLiveTrades([result.journalEntry]);
      if (!wh.ok) {
        return NextResponse.json(
          {
            ...result,
            ok: false,
            error:
              wh.errors.join("; ") ||
              "Live trade executed but warehouse write failed — blocked for safety.",
            warehouseBlocked: true,
            clientMustPersistJournal: true,
          },
          { status: 422 },
        );
      }
    }

    return NextResponse.json(
      {
        ...result,
        clientMustPersistJournal: true,
        cannotEnablePilot: true,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

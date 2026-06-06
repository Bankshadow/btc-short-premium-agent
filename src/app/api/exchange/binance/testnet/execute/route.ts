import { executeBinanceTestnetOrder } from "@/lib/exchange/binance";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { evaluateRiskyActionGate } from "@/lib/anomaly-detection";
import type { BinanceExecuteInput } from "@/lib/exchange/binance/binance-types";
import { buildPolicyInput } from "@/lib/policy-engine";
import { enforcePolicy } from "@/lib/policy-engine/enforce";
import { parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = BinanceExecuteInput & {
  operatorNote?: string;
  governance?: import("@/lib/governance/governance-types").GovernanceDeskState;
  commandCenter?: { status: string; blockers?: string[] };
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  environmentMode?: string;
};

export async function POST(request: Request) {
  try {
    const anomalyGate = await evaluateRiskyActionGate(
      "binance testnet execute",
    );
    if (!anomalyGate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          error: anomalyGate.reason,
          blockedByIncidents: anomalyGate.criticalIncidentIds,
        },
        { status: 422 },
      );
    }

    const productionBlock = blockBinanceProductionOrder();
    if (productionBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: productionBlock,
          productionBlocked: true,
        },
        { status: 422 },
      );
    }

    const body = (await request.json()) as Body;
    if (!body.previewId) {
      return NextResponse.json({ error: "previewId required" }, { status: 400 });
    }

    const wsCtx = parseApiWorkspaceContext(
      request,
      body as unknown as Record<string, unknown>,
    );
    const policy = enforcePolicy(
      buildPolicyInput({
        workspaceId: wsCtx.workspaceId ?? "server-default",
        userRole: wsCtx.role ?? "TRADER",
        environmentMode: body.environmentMode ?? "PAPER",
        action: "EXECUTE_BINANCE_TESTNET",
        governance: body.governance,
        entries: body.entries,
        orders: body.orders,
        operatorApproval: body.doubleConfirm,
      }),
    );
    if (!policy.ok) {
      return NextResponse.json(
        { ok: false, error: policy.error, policy: policy.result },
        { status: policy.status },
      );
    }

    const result = await executeBinanceTestnetOrder({
      execute: {
        previewId: body.previewId,
        doubleConfirm: body.doubleConfirm === true,
        operatorNote: body.operatorNote,
      },
      commandCenterStatus: body.commandCenter?.status,
      governance: body.governance,
      entries: body.entries,
      orders: body.orders,
      operatorNote: body.operatorNote,
    });

    return NextResponse.json(
      {
        ...result,
        clientMustPersistJournal: true,
        liveBlocked: true,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execute failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

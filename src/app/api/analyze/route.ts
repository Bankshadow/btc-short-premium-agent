import { enrichAnalyzeWithMvp9 } from "@/lib/desk/enrich-analyze-mvp9";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { BYBIT_API_FAILED_MESSAGE } from "@/lib/decision/bybit-health";
import type {
  AnalysisInput,
  DecisionEngineInput,
} from "@/lib/types/market";
import { enforcePolicy } from "@/lib/policy-engine/enforce";
import { buildPolicyInputWithObservability } from "@/lib/observability/policy-context";
import { enforceApiPermission, parseApiWorkspaceContext } from "@/lib/platform/api-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let body: Partial<DecisionEngineInput> & AnalysisInput = {};

    try {
      body = (await request.json()) as Partial<DecisionEngineInput> &
        AnalysisInput &
        Record<string, unknown>;
    } catch {
      // Empty body — use fetched defaults
    }

    const wsCtx = parseApiWorkspaceContext(request, body as Record<string, unknown>);
    if (wsCtx.workspaceId) {
      const perm = enforceApiPermission(wsCtx, "canRunAnalysis");
      if (!perm.ok) {
        return NextResponse.json({ error: perm.error }, { status: perm.status });
      }

      const policy = enforcePolicy(
        await buildPolicyInputWithObservability({
          workspaceId: wsCtx.workspaceId,
          userRole: wsCtx.role ?? "TRADER",
          environmentMode: (body as Record<string, unknown>).environmentMode as string ?? "PAPER",
          action: "RUN_ANALYSIS",
          governance: (body as Record<string, unknown>).governance as never,
        }),
      );
      if (!policy.ok) {
        return NextResponse.json(
          { error: policy.error, policy: policy.result },
          { status: policy.status },
        );
      }
    }

    const result = await enrichAnalyzeWithMvp9(await runAnalyzeRequest(body));
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    const isBybit =
      message.toLowerCase().includes("bybit") ||
      message.includes("BTCUSDT ticker");
    return NextResponse.json(
      { error: isBybit ? BYBIT_API_FAILED_MESSAGE : message },
      { status: 500 },
    );
  }
}

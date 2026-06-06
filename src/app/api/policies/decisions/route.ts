import { loadPolicyDecisions } from "@/lib/policy-engine/audit-store";
import { POLICY_RULES } from "@/lib/policy-engine/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const decisions = await loadPolicyDecisions();
    const blocked = decisions.filter((d) => d.decision === "BLOCK").slice(0, limit);
    const recent = decisions.slice(0, limit);

    return NextResponse.json({
      ok: true,
      rules: POLICY_RULES,
      recent,
      blocked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

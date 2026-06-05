import type { DeskIncident, GovernanceDeskState } from "@/lib/governance/governance-types";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DeskCloudSettings } from "@/lib/desk/desk-settings";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { formatReadinessReport } from "@/lib/live-readiness/format-report";
import { buildServerReadinessContext } from "@/lib/live-readiness/server-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReportBody = {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: "balanced" | "aggressive";
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  overrideLog?: OperatorOverrideLogEntry[];
  deskSettings?: DeskCloudSettings;
  latestAnalysis?: AnalyzeApiResponse | null;
  format?: "markdown" | "text" | "json" | "all";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReportBody;
    const serverContext = await buildServerReadinessContext();
    const report = buildLiveReadinessReport({
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions ?? [],
      riskProfile: body.riskProfile ?? "balanced",
      governance: body.governance,
      incidents: body.incidents,
      overrideLog: body.overrideLog,
      deskSettings: body.deskSettings,
      latestAnalysis: body.latestAnalysis ?? null,
      serverContext,
    });

    const exported = formatReadinessReport(report);
    const format = body.format ?? "all";

    if (format === "markdown") {
      return NextResponse.json({ ok: true, markdown: exported.markdown });
    }
    if (format === "text") {
      return NextResponse.json({ ok: true, text: exported.text });
    }
    if (format === "json") {
      return NextResponse.json({ ok: true, report: exported.json });
    }

    return NextResponse.json({
      ok: true,
      report: exported.json,
      markdown: exported.markdown,
      text: exported.text,
      cannotEnableLive: true,
      cannotPlaceTrades: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Readiness report export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import {
  buildLiveEvidenceReport,
  formatLiveEvidenceReport,
  type LiveEvidenceBuildInput,
} from "@/lib/live-evidence";
import { buildServerLiveEvidenceInput } from "@/lib/live-evidence/build-server-evidence-input";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  format?: "json" | "markdown" | "text" | "all";
  thresholds?: LiveEvidenceBuildInput["thresholds"];
};

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty body */
    }
    const input = await buildServerLiveEvidenceInput();
    const report = buildLiveEvidenceReport({
      ...input,
      thresholds: body.thresholds ?? input.thresholds,
    });
    const exported = formatLiveEvidenceReport(report);
    const format = body.format ?? "all";

    if (format === "json") {
      return NextResponse.json({ ok: true, report: exported.json });
    }
    if (format === "markdown") {
      return NextResponse.json({ ok: true, markdown: exported.markdown });
    }
    if (format === "text") {
      return NextResponse.json({ ok: true, text: exported.text });
    }
    return NextResponse.json({
      ok: true,
      report: exported.json,
      markdown: exported.markdown,
      text: exported.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live evidence export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createStrategyVersionManual } from "@/lib/versioning/change-control";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: string;
      changelog?: string[];
      createdBy?: string;
    };
    if (!body.label?.trim()) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const version = await createStrategyVersionManual({
      label: body.label,
      changelog: body.changelog ?? [],
      createdBy: body.createdBy ?? "operator",
    });
    return NextResponse.json({ ok: true, version, sprint: "mvp-18" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create version failed" },
      { status: 500 },
    );
  }
}

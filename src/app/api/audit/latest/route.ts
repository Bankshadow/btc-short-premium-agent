import { NextResponse } from "next/server";
import { getLatestAuditPack } from "@/lib/audit/audit-pack-generator";

export async function GET() {
  try {
    return NextResponse.json({ pack: await getLatestAuditPack(), sprint: "mvp-24" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

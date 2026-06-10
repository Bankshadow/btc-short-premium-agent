import { NextResponse } from "next/server";
import { retrieveRegimeMemory } from "@/lib/regime/regime-retrieval";

export async function GET() {
  try {
    const memory = await retrieveRegimeMemory();
    return NextResponse.json({ memory, sprint: "mvp-14" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve memory" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { loadAdvancedModulesSnapshotForApi } from "@/lib/advanced-modules/load-advanced-modules-snapshot";
import type { AdvancedModuleId } from "@/lib/advanced-modules/types";
import { ADVANCED_MODULE_REGISTRY } from "@/lib/advanced-modules/registry";

export const dynamic = "force-dynamic";

const VALID_IDS = new Set(ADVANCED_MODULE_REGISTRY.map((m) => m.id));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId") as AdvancedModuleId | null;

    if (moduleId && !VALID_IDS.has(moduleId)) {
      return NextResponse.json(
        { ok: false, error: `Unknown moduleId: ${moduleId}` },
        { status: 400 },
      );
    }

    const { snapshot, module } = await loadAdvancedModulesSnapshotForApi(
      moduleId ? { moduleId } : undefined,
    );

    return NextResponse.json({
      ok: true,
      snapshot,
      module,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Advanced modules failed",
      },
      { status: 500 },
    );
  }
}

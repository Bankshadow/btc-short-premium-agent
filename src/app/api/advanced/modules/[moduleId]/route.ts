import { NextResponse } from "next/server";
import { loadAdvancedModulesSnapshotForApi } from "@/lib/advanced-modules/load-advanced-modules-snapshot";
import type { AdvancedModuleId } from "@/lib/advanced-modules/types";
import { getAdvancedModuleDefinition } from "@/lib/advanced-modules/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ moduleId: string }> },
) {
  try {
    const { moduleId: rawId } = await context.params;
    const def = getAdvancedModuleDefinition(rawId as AdvancedModuleId);

    if (!def) {
      return NextResponse.json(
        { ok: false, error: `Unknown moduleId: ${rawId}` },
        { status: 404 },
      );
    }

    const { snapshot, module } = await loadAdvancedModulesSnapshotForApi({
      moduleId: def.id,
    });

    return NextResponse.json({
      ok: true,
      snapshot: {
        mvp: snapshot.mvp,
        label: snapshot.label,
        generatedAt: snapshot.generatedAt,
      },
      module,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Advanced module failed",
      },
      { status: 500 },
    );
  }
}

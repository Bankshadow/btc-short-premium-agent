import { NextResponse } from "next/server";
import {
  applyConsistencyAutoFix,
} from "@/lib/engine-consistency/apply-consistency-auto-fix";
import { buildEngineConsistencySnapshot } from "@/lib/engine-consistency/build-engine-consistency";
import type { ConsistencyAutoFixId } from "@/lib/engine-consistency/types";

export const dynamic = "force-dynamic";

const VALID_FIXES = new Set<ConsistencyAutoFixId>([
  "journal_reconcile",
  "journal_backfill",
  "learning_sync",
  "mission_snapshot_refresh",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      actions?: ConsistencyAutoFixId[];
      applyRecommended?: boolean;
    };

    let actions = body.actions?.filter((a) => VALID_FIXES.has(a)) ?? [];

    if (body.applyRecommended && actions.length === 0) {
      const snapshot = await buildEngineConsistencySnapshot();
      actions = snapshot.autoFixActions.filter((a) => VALID_FIXES.has(a));
    }

    if (actions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid auto-fix actions specified." },
        { status: 400 },
      );
    }

    const result = await applyConsistencyAutoFix(actions);
    const snapshot = await buildEngineConsistencySnapshot();

    return NextResponse.json({
      ok: result.ok,
      result,
      snapshot,
      liveTradingLocked: true,
      tradesOpened: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Auto-fix failed",
      },
      { status: 500 },
    );
  }
}

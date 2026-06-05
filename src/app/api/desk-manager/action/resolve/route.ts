import { resolveDeskManagerActionPure } from "@/lib/autonomous-desk-manager/resolve-action";
import type { DeskManagerAction } from "@/lib/autonomous-desk-manager/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actionId: string;
      status: "RESOLVED" | "DISMISSED";
      queue?: DeskManagerAction[];
    };

    if (!body.actionId || !body.status) {
      return NextResponse.json(
        { ok: false, error: "actionId and status required" },
        { status: 400 },
      );
    }

    const { queue, action } = resolveDeskManagerActionPure(
      body.queue ?? [],
      body.actionId,
      body.status,
    );

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Action not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      queue,
      clientMustPersist: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resolve failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

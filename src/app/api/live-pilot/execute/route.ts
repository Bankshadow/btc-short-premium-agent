import { assertLiveWriteHealthy } from "@/lib/db/write-health";
import { writeThroughLiveTrades } from "@/lib/db/write-through";
import { executePilotPerpOrder } from "@/lib/live-pilot/pilot-execution";
import type { PilotExecuteInput } from "@/lib/live-pilot/pilot-execution";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PilotExecuteInput;

    if (!body.signal?.symbol || !body.confirmToken || !body.confirmExpiresAt) {
      return NextResponse.json(
        { error: "Missing signal, confirmToken, or confirmExpiresAt" },
        { status: 400 },
      );
    }

    if (body.signal.hasOptions) {
      return NextResponse.json(
        { error: "BTC options live is not available." },
        { status: 422 },
      );
    }

    if (!body.operatorApproval) {
      return NextResponse.json(
        { error: "operatorApproval must be true." },
        { status: 422 },
      );
    }

    const writeHealth = await assertLiveWriteHealthy();
    if (!writeHealth.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: writeHealth.reason,
          warehouseBlocked: true,
        },
        { status: 422 },
      );
    }

    const result = await executePilotPerpOrder(body);

    if (result.journalEntry) {
      const wh = await writeThroughLiveTrades([result.journalEntry]);
      if (!wh.ok) {
        return NextResponse.json(
          {
            ...result,
            ok: false,
            error:
              wh.errors.join("; ") ||
              "Live trade executed but warehouse write failed — blocked for safety.",
            warehouseBlocked: true,
            clientMustPersistJournal: true,
          },
          { status: 422 },
        );
      }
    }

    return NextResponse.json(
      {
        ...result,
        clientMustPersistJournal: true,
        cannotEnablePilot: true,
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

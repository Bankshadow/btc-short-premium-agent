import { NextResponse } from "next/server";
import { promoteTournamentWinner } from "@/lib/strategy-tournament/promote-winner";
import { TOURNAMENT_SAFETY_NOTICE } from "@/lib/strategy-tournament/types";
import type { PromoteTournamentWinnerInput } from "@/lib/strategy-tournament/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromoteTournamentWinnerInput;
    const result = await promoteTournamentWinner(body);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.message,
          executionBlocked: true,
          safetyNotice: TOURNAMENT_SAFETY_NOTICE,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      executionBlocked: true,
      cannotCreateOrders: true,
      safetyNotice: TOURNAMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tournament promote failed";
    return NextResponse.json(
      { ok: false, error: message, executionBlocked: true },
      { status: 500 },
    );
  }
}

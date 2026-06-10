import { NextResponse } from "next/server";
import { disableKillSwitch } from "@/lib/operator/operator-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { doubleConfirm?: boolean };
    const result = await disableKillSwitch({ doubleConfirm: body.doubleConfirm === true });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Disable failed" },
      { status: 500 },
    );
  }
}

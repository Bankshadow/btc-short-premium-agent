import { NextResponse } from "next/server";
import { resumeEngine } from "@/lib/operator/operator-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { doubleConfirm?: boolean };
    const result = await resumeEngine({ doubleConfirm: body.doubleConfirm === true });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Resume failed" }, { status: 500 });
  }
}

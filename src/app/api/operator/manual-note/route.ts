import { NextResponse } from "next/server";
import { createManualNote } from "@/lib/operator/operator-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const result = await createManualNote({ text: body.text ?? "" });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Note failed" },
      { status: 500 },
    );
  }
}

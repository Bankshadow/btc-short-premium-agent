import { NextResponse } from "next/server";
import { getLatestClosePreviewView } from "@/lib/execution/close-preview-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get("tradeId") ?? undefined;
    const view = await getLatestClosePreviewView(tradeId);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load close preview" },
      { status: 500 },
    );
  }
}

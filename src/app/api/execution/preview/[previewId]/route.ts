import { NextResponse } from "next/server";
import { getPreviewById } from "@/lib/execution/preview-store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ previewId: string }> },
) {
  try {
    const { previewId } = await ctx.params;
    const preview = await getPreviewById(previewId);

    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load preview" },
      { status: 500 },
    );
  }
}

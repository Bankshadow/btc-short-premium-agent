import { NextResponse } from "next/server";
import {
  countPreviews,
  getLatestActivePreview,
  latestPreviewZeroState,
} from "@/lib/execution/preview-store";

export async function GET() {
  try {
    const preview = await getLatestActivePreview();
    const previewCount = await countPreviews();

    if (!preview) {
      return NextResponse.json({
        ...latestPreviewZeroState(),
        previewCount,
      });
    }

    return NextResponse.json({
      preview,
      previewCount,
      latestPreviewStatus: preview.status,
      message: "Latest active testnet preview.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load preview" },
      { status: 500 },
    );
  }
}

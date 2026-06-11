import { NextResponse } from "next/server";
import { buildProjectionBundle } from "@/lib/core/projection-bundle";

export async function GET() {
  const bundle = await buildProjectionBundle();
  return NextResponse.json(bundle);
}

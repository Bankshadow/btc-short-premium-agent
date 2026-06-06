import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Server status — client builds backbone; this confirms API availability. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    version: 1,
    message: "Data backbone reads from client localStorage with progressive migration.",
    serverBuild: false,
  });
}

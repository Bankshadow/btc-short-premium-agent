import { dispatchExternalBriefing, sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import { SMART_BRIEFING_SAFETY_NOTICE } from "@/lib/smart-briefing/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      discordWebhookUrl?: string;
      deskWebhookUrl?: string;
    };

    const message = sanitizeBriefingText(body.message?.trim() ?? "");
    if (!message) {
      return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
    }

    const channelResults = await dispatchExternalBriefing({
      message,
      discordWebhookUrl: body.discordWebhookUrl,
      deskWebhookUrl: body.deskWebhookUrl,
    });

    return NextResponse.json({
      ok: true,
      channelResults,
      safetyNotice: SMART_BRIEFING_SAFETY_NOTICE,
      cannotExecuteTrades: true,
      cannotApproveActions: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

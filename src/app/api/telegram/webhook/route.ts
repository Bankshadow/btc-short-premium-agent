import { NextResponse } from "next/server";
import {
  handleTelegramCommand,
  isAuthorizedOperatorChat,
  parseTelegramCommand,
  verifyTelegramWebhookSecret,
  sendTelegramChatMessage,
  TELEGRAM_CONTROL_SAFETY_NOTICE,
  isTelegramControlEnabled,
} from "@/lib/telegram-control-channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string; type?: string };
  };
};

/** MVP 77 — inbound Telegram bot webhook for operator commands. */
export async function POST(request: Request) {
  try {
    if (!isTelegramControlEnabled()) {
      return NextResponse.json({ ok: false, error: "Telegram control not configured" }, { status: 503 });
    }

    if (!verifyTelegramWebhookSecret(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const update = (await request.json()) as TelegramUpdate;
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;

    if (!text || chatId == null) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!isAuthorizedOperatorChat(chatId)) {
      return NextResponse.json({ ok: false, error: "Chat not authorized" }, { status: 403 });
    }

    if (!text.startsWith("/")) {
      return NextResponse.json({ ok: true, ignored: true, hint: "Send /help for commands" });
    }

    const { command } = parseTelegramCommand(text);
    const result = await handleTelegramCommand({
      command,
      chatId: String(chatId),
    });

    if (command !== "/status") {
      await sendTelegramChatMessage({
        chatId: String(chatId),
        text: result.reply,
      });
    } else if (!result.ok) {
      await sendTelegramChatMessage({
        chatId: String(chatId),
        text: result.reply,
      });
    }

    return NextResponse.json({
      ok: result.ok,
      mvp: 77,
      command,
      safetyNotice: TELEGRAM_CONTROL_SAFETY_NOTICE,
      permissionHandled: result.permissionHandled ?? false,
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

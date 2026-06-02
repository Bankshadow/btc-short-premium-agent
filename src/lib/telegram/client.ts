const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramConfigError";
  }
}

export class TelegramApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "TelegramApiError";
    this.statusCode = statusCode;
  }
}

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

function getTelegramCredentials(): { token: string; chatId: string } {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token) {
    throw new TelegramConfigError("TELEGRAM_BOT_TOKEN is not configured.");
  }
  if (!chatId) {
    throw new TelegramConfigError("TELEGRAM_CHAT_ID is not configured.");
  }

  return { token, chatId };
}

/**
 * Sends a plain-text message via the Telegram Bot API.
 * Analysis notifications only — does not place or route orders.
 */
export async function sendTelegramMessage(
  text: string,
): Promise<{ messageId: number }> {
  const { token, chatId } = getTelegramCredentials();

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  const payload = (await response.json()) as TelegramSendMessageResponse;

  if (!response.ok || !payload.ok) {
    throw new TelegramApiError(
      payload.description ?? `Telegram API HTTP ${response.status}`,
      response.status,
    );
  }

  const messageId = payload.result?.message_id;
  if (messageId == null) {
    throw new TelegramApiError("Telegram API returned no message_id.", 502);
  }

  return { messageId };
}

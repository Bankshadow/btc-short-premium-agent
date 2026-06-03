const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramNotifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramNotifyError";
  }
}

/**
 * Sends a plain-text message via the Telegram Bot API.
 * Analysis notifications only — does not place or route orders.
 */
export async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token) {
    throw new TelegramNotifyError("TELEGRAM_BOT_TOKEN is not configured.");
  }
  if (!chatId) {
    throw new TelegramNotifyError("TELEGRAM_CHAT_ID is not configured.");
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    },
  );

  const payload = (await response.json()) as {
    ok: boolean;
    description?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new TelegramNotifyError(
      payload.description ?? `Telegram API HTTP ${response.status}`,
    );
  }
}

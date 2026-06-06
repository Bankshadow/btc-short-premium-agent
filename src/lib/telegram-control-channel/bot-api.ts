const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramBotApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramBotApiError";
  }
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new TelegramBotApiError("TELEGRAM_BOT_TOKEN is not configured.");
  return token;
}

function getDefaultChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) throw new TelegramBotApiError("TELEGRAM_CHAT_ID is not configured.");
  return chatId;
}

async function telegramRequest<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
  };
  if (!response.ok || !payload.ok) {
    throw new TelegramBotApiError(
      payload.description ?? `Telegram API HTTP ${response.status}`,
    );
  }
  return payload.result as T;
}

export async function sendTelegramChatMessage(input: {
  chatId?: string;
  text: string;
  disablePreview?: boolean;
}): Promise<{ message_id: number; chat: { id: number } }> {
  return telegramRequest("sendMessage", {
    chat_id: input.chatId ?? getDefaultChatId(),
    text: input.text,
    disable_web_page_preview: input.disablePreview !== false,
  });
}

export async function editTelegramChatMessage(input: {
  chatId?: string;
  messageId: number;
  text: string;
}): Promise<{ message_id: number }> {
  return telegramRequest("editMessageText", {
    chat_id: input.chatId ?? getDefaultChatId(),
    message_id: input.messageId,
    text: input.text,
    disable_web_page_preview: true,
  });
}

export async function pinTelegramChatMessage(input: {
  chatId?: string;
  messageId: number;
}): Promise<boolean> {
  return telegramRequest("pinChatMessage", {
    chat_id: input.chatId ?? getDefaultChatId(),
    message_id: input.messageId,
    disable_notification: true,
  });
}

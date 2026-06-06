import { getTelegramOperatorChatIds, getTelegramWebhookSecret } from "./config";

export function isAuthorizedOperatorChat(chatId: string | number): boolean {
  const allowed = getTelegramOperatorChatIds();
  if (allowed.length === 0) return false;
  return allowed.includes(String(chatId));
}

export function verifyTelegramWebhookSecret(request: Request): boolean {
  const expected = getTelegramWebhookSecret();
  if (!expected) return true;

  const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (header && header === expected) return true;

  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return query === expected;
}

export function parseTelegramCommand(text: string): { command: string; args: string } {
  const trimmed = text.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  const command = first.split("@")[0].toLowerCase();
  const args = trimmed.slice(first.length).trim();
  return { command, args };
}

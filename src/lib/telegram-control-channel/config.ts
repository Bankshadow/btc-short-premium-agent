export const TELEGRAM_CONTROL_STORE_FILE = "telegram-control-channel.json";

/** Align with Binance preview TTL (5 min). */
export const TELEGRAM_PERMISSION_TTL_MS = 5 * 60 * 1000;

export const TELEGRAM_COMMANDS: TelegramCommandDef[] = [
  { command: "/status", description: "Pinned mission status" },
  { command: "/mission", description: "Goal progress & trust" },
  { command: "/trades", description: "Recent trades" },
  { command: "/position", description: "Open position" },
  { command: "/start_ai", description: "Run one AI desk cycle" },
  { command: "/pause_ai", description: "Pause autopilot" },
  { command: "/approve", description: "Approve pending testnet action" },
  { command: "/deny", description: "Deny pending action" },
  { command: "/report", description: "Mission digest" },
  { command: "/risk", description: "Risk summary" },
  { command: "/help", description: "Command list" },
];

export interface TelegramCommandDef {
  command: string;
  description: string;
}

export function isTelegramControlEnabled(): boolean {
  if (process.env.TELEGRAM_CONTROL_CHANNEL_ENABLED === "false") return false;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return Boolean(token && chatId);
}

export function getTelegramOperatorChatIds(): string[] {
  const primary = process.env.TELEGRAM_CHAT_ID?.trim();
  const extra = process.env.TELEGRAM_OPERATOR_CHAT_IDS?.trim();
  const ids = new Set<string>();
  if (primary) ids.add(primary);
  if (extra) {
    for (const part of extra.split(",")) {
      const id = part.trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function getTelegramWebhookSecret(): string | null {
  return (
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

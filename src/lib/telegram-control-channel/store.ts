import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import type { TelegramControlChannelState, TelegramPermissionPrompt } from "./types";
import { TELEGRAM_CONTROL_STORE_FILE } from "./config";
import { isTelegramControlEnabled } from "./config";

const memory = defaultTelegramControlState();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), TELEGRAM_CONTROL_STORE_FILE);
}

export function defaultTelegramControlState(
  workspaceId = "server-default",
): TelegramControlChannelState {
  return {
    workspaceId,
    enabled: isTelegramControlEnabled(),
    pinnedChatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? null,
    pinnedMessageId: null,
    lastPermissionPrompt: null,
    lastSyncedAt: null,
    lastCommandAt: null,
    updatedAt: new Date().toISOString(),
  };
}

async function readState(): Promise<TelegramControlChannelState> {
  if (!isServer()) return memory;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as TelegramControlChannelState;
    return { ...defaultTelegramControlState(parsed.workspaceId), ...parsed };
  } catch {
    return defaultTelegramControlState();
  }
}

async function writeState(state: TelegramControlChannelState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.enabled = isTelegramControlEnabled();
  if (!isServer()) {
    Object.assign(memory, state);
    return;
  }
  try {
    const fs = await import("fs/promises");
    const filePath = storePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  } catch {
    Object.assign(memory, state);
  }
}

export async function loadTelegramControlState(
  workspaceId = "server-default",
): Promise<TelegramControlChannelState> {
  const state = await readState();
  state.workspaceId = workspaceId;
  return state;
}

export async function saveTelegramControlState(
  state: TelegramControlChannelState,
): Promise<void> {
  await writeState(state);
}

export async function resetTelegramControlForTests(): Promise<void> {
  await writeState(defaultTelegramControlState());
}

export function isPermissionPromptActive(
  prompt: TelegramPermissionPrompt | null | undefined,
): prompt is TelegramPermissionPrompt {
  if (!prompt || prompt.status !== "PENDING") return false;
  return Date.now() <= Date.parse(prompt.expiresAt);
}

export const TELEGRAM_CONTROL_SAFETY_NOTICE =
  "Telegram control is testnet-only — live trading cannot be enabled from chat. Approvals expire; execute/close still require explicit /approve (double confirm).";

export type TelegramCommand =
  | "/status"
  | "/mission"
  | "/trades"
  | "/position"
  | "/start_ai"
  | "/pause_ai"
  | "/approve"
  | "/deny"
  | "/report"
  | "/risk"
  | "/help";

export type TelegramPermissionKind =
  | "EXECUTE_TESTNET"
  | "CLOSE_TESTNET"
  | "LOOP_CONTINUE";

export type TelegramPermissionStatus =
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "EXPIRED";

export interface TelegramPermissionPrompt {
  promptId: string;
  kind: TelegramPermissionKind;
  createdAt: string;
  expiresAt: string;
  status: TelegramPermissionStatus;
  summary: string;
  previewId?: string | null;
  symbol?: string | null;
  side?: string | null;
  notionalUsd?: number | null;
  promptMessageId?: number | null;
}

export interface TelegramControlChannelState {
  workspaceId: string;
  enabled: boolean;
  pinnedChatId: string | null;
  pinnedMessageId: number | null;
  lastPermissionPrompt: TelegramPermissionPrompt | null;
  lastSyncedAt: string | null;
  lastCommandAt: string | null;
  updatedAt: string;
}

export interface TelegramCommandResult {
  ok: boolean;
  reply: string;
  error?: string;
  permissionHandled?: boolean;
}

export interface TelegramSyncResult {
  ok: boolean;
  pinnedUpdated: boolean;
  permissionPromptSent: boolean;
  skipped?: string;
}

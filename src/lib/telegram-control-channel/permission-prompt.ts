import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type { AiStatusCardState } from "@/lib/ai-status/types";
import { TELEGRAM_PERMISSION_TTL_MS } from "./config";
import type { TelegramPermissionKind, TelegramPermissionPrompt } from "./types";

function newPromptId(): string {
  return `tgperm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type DetectedPermissionPrompt = Omit<
  TelegramPermissionPrompt,
  "promptId" | "createdAt" | "status" | "promptMessageId"
>;

export function detectPermissionPrompt(input: {
  mission: MissionFlowSnapshot;
  aiCard?: AiStatusCardState | null;
}): DetectedPermissionPrompt | null {
  const preview = input.mission.pendingTestnetPreview;
  if (preview && !preview.blocked) {
    const expiresAt = Math.min(
      Date.parse(preview.expiresAt),
      Date.now() + TELEGRAM_PERMISSION_TTL_MS,
    );
    return {
      kind: "EXECUTE_TESTNET",
      summary: `Approve testnet ${preview.side} ${preview.symbol} · $${preview.notionalUsd}`,
      previewId: preview.previewId,
      symbol: preview.symbol,
      side: preview.side,
      notionalUsd: preview.notionalUsd,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  const loop = input.aiCard?.loopBlocker;
  if (
    loop &&
    (loop.active || loop.riskLevel === "SUSPICIOUS") &&
    input.mission.aiStatus.humanActionRequired
  ) {
    return {
      kind: "LOOP_CONTINUE",
      summary: loop.reason ?? "Suspicious autopilot loop — approve one continue cycle",
      previewId: null,
      symbol: null,
      side: null,
      notionalUsd: null,
      expiresAt: new Date(Date.now() + TELEGRAM_PERMISSION_TTL_MS).toISOString(),
    };
  }

  const pos = input.mission.currentPosition;
  const next = input.mission.aiStatus.nextAction.toLowerCase();
  if (
    pos?.canCloseOnTestnet &&
    input.mission.aiStatus.humanActionRequired &&
    (next.includes("close") || next.includes("reduce"))
  ) {
    return {
      kind: "CLOSE_TESTNET",
      summary: `Approve reduce-only close ${pos.symbol} ${pos.side}`,
      previewId: null,
      symbol: pos.symbol,
      side: pos.side,
      notionalUsd: null,
      expiresAt: new Date(Date.now() + TELEGRAM_PERMISSION_TTL_MS).toISOString(),
    };
  }

  return null;
}

export function buildPermissionPrompt(
  partial: DetectedPermissionPrompt,
): TelegramPermissionPrompt {
  return {
    promptId: newPromptId(),
    createdAt: new Date().toISOString(),
    status: "PENDING",
    promptMessageId: null,
    ...partial,
  };
}

export function expirePermissionPrompt(
  prompt: TelegramPermissionPrompt,
): TelegramPermissionPrompt {
  if (prompt.status !== "PENDING") return prompt;
  if (Date.now() <= Date.parse(prompt.expiresAt)) return prompt;
  return { ...prompt, status: "EXPIRED" };
}

export function permissionKindLabel(kind: TelegramPermissionKind): string {
  switch (kind) {
    case "EXECUTE_TESTNET":
      return "testnet execute";
    case "CLOSE_TESTNET":
      return "reduce-only close";
    case "LOOP_CONTINUE":
      return "loop continue";
    default:
      return kind;
  }
}

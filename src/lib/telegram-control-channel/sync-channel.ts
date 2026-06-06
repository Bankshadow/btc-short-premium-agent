import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { buildAiStatusCardState } from "@/lib/ai-status/build-card-state";
import { loadAiStatusEvents, getActiveAiRunId } from "@/lib/ai-status/event-store";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import {
  editTelegramChatMessage,
  pinTelegramChatMessage,
  sendTelegramChatMessage,
} from "./bot-api";
import { isTelegramControlEnabled } from "./config";
import {
  formatPermissionPromptMessage,
  formatPinnedStatusMessage,
} from "./format-messages";
import {
  buildPermissionPrompt,
  detectPermissionPrompt,
  expirePermissionPrompt,
} from "./permission-prompt";
import {
  isPermissionPromptActive,
  loadTelegramControlState,
  saveTelegramControlState,
} from "./store";
import type { TelegramSyncResult } from "./types";

export async function syncTelegramControlChannel(input?: {
  workspaceId?: string;
  chatId?: string;
  sendPermissionPrompt?: boolean;
}): Promise<TelegramSyncResult> {
  if (!isTelegramControlEnabled()) {
    return { ok: false, pinnedUpdated: false, permissionPromptSent: false, skipped: "not configured" };
  }

  const workspaceId = input?.workspaceId ?? "server-default";
  const chatId = input?.chatId ?? process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) {
    return { ok: false, pinnedUpdated: false, permissionPromptSent: false, skipped: "no chat id" };
  }

  const [missionResult, events, loopGuard, secondBrain, parallelRunner] = await Promise.all([
    buildMissionFlowServerSnapshot({ fresh: true }),
    loadAiStatusEvents(30),
    getLoopGuardDashboardSnapshot().catch(() => null),
    getSecondBrainDashboardSnapshot().catch(() => null),
    getParallelTaskRunnerSnapshot().catch(() => null),
  ]);

  const mission = missionResult.snapshot;
  const aiCard = buildAiStatusCardState({
    events,
    activeRunId: getActiveAiRunId(),
    permissionNeeded: mission.aiStatus.humanActionRequired,
    loopGuard: loopGuard
      ? {
          blocker: loopGuard.blocker,
          decision: loopGuard.decision,
          selfCheckSummary: loopGuard.lastSelfCheckSummary,
        }
      : null,
    memorySummary: secondBrain?.summary ?? null,
    committee: parallelRunner?.lastRun
      ? {
          committee: parallelRunner.lastRun.committee,
          reviews: parallelRunner.lastRun.reviews,
          completedAt: parallelRunner.lastRun.completedAt,
        }
      : null,
  });

  const state = await loadTelegramControlState(workspaceId);
  let permission = state.lastPermissionPrompt
    ? expirePermissionPrompt(state.lastPermissionPrompt)
    : null;

  if (!isPermissionPromptActive(permission)) {
    const detected = detectPermissionPrompt({ mission, aiCard });
    if (detected) {
      permission = buildPermissionPrompt(detected);
      state.lastPermissionPrompt = permission;
    }
  }

  const pinnedText = formatPinnedStatusMessage({
    mission,
    aiCard,
    permission: isPermissionPromptActive(permission) ? permission : null,
  });

  let pinnedUpdated = false;
  try {
    if (state.pinnedMessageId && state.pinnedChatId === chatId) {
      await editTelegramChatMessage({
        chatId,
        messageId: state.pinnedMessageId,
        text: pinnedText,
      });
      pinnedUpdated = true;
    } else {
      const sent = await sendTelegramChatMessage({ chatId, text: pinnedText });
      state.pinnedMessageId = sent.message_id;
      state.pinnedChatId = String(sent.chat.id);
      try {
        await pinTelegramChatMessage({
          chatId: state.pinnedChatId,
          messageId: sent.message_id,
        });
      } catch {
        /* pin may fail in some group settings */
      }
      pinnedUpdated = true;
    }
  } catch {
    return {
      ok: false,
      pinnedUpdated: false,
      permissionPromptSent: false,
      skipped: "telegram send failed",
    };
  }

  let permissionPromptSent = false;
  const shouldPrompt =
    input?.sendPermissionPrompt !== false &&
    permission &&
    isPermissionPromptActive(permission) &&
    !permission.promptMessageId;

  if (shouldPrompt && permission) {
    try {
      const sent = await sendTelegramChatMessage({
        chatId,
        text: formatPermissionPromptMessage(permission),
      });
      permission = { ...permission, promptMessageId: sent.message_id };
      state.lastPermissionPrompt = permission;
      permissionPromptSent = true;
    } catch {
      /* best-effort */
    }
  }

  state.lastSyncedAt = new Date().toISOString();
  await saveTelegramControlState(state);

  return { ok: true, pinnedUpdated, permissionPromptSent };
}

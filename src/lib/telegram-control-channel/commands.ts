import { pauseAutomation } from "@/lib/automation-control-plane/scheduler";
import { buildGoalTradeListServer } from "@/lib/goal-engine/build-server-context";
import { runGoalStartAiCycle } from "@/lib/goal-engine/run-start-ai-cycle";
import {
  buildMissionFlowServerSnapshot,
  invalidateMissionSnapshotCache,
} from "@/lib/mission-flow/build-server-snapshot";
import { evaluateRealTimeRisk, enrichRealTimeRiskInput } from "@/lib/real-time-risk";
import { grantSuspiciousLoopPermission } from "@/lib/autopilot-loop-guard/run-guard";
import { executeBinanceTestnetClose, executeBinanceTestnetOrder } from "@/lib/exchange/binance";
import { sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import { isTelegramControlEnabled } from "./config";
import {
  formatHelpMessage,
  formatMissionSummary,
  formatPositionSummary,
  formatRiskSummary,
  formatTradesSummary,
} from "./format-messages";
import { expirePermissionPrompt, permissionKindLabel } from "./permission-prompt";
import {
  isPermissionPromptActive,
  loadTelegramControlState,
  saveTelegramControlState,
} from "./store";
import { syncTelegramControlChannel } from "./sync-channel";
import type { TelegramCommandResult } from "./types";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

async function buildMissionDigest(): Promise<string> {
  const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
  const lastActivity = snapshot.recentActivity[0];
  return sanitizeBriefingText(
    [
      `Mission digest · ${new Date().toLocaleString()}`,
      `Equity: ${usd(snapshot.currentEquity)} (${snapshot.progressPct}% to target)`,
      `Trades: ${snapshot.closedTrades} closed · ${snapshot.openTrades} open · PnL ${usd(snapshot.netPnl)}`,
      `Trust: ${snapshot.trust.completedTrades}/${snapshot.trust.minRequired}`,
      `Autopilot: ${snapshot.automation.paused ? "paused" : "on"} · ${lastActivity?.summary ?? "—"}`,
      `AI: ${snapshot.aiStatus.state} · ${snapshot.aiStatus.nextAction}`,
      snapshot.risk.blocker ? `Blocker: ${snapshot.risk.blocker}` : null,
      snapshot.nextRecommendation,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function handleApprove(chatId: string): Promise<TelegramCommandResult> {
  const state = await loadTelegramControlState();
  const prompt = expirePermissionPrompt(state.lastPermissionPrompt ?? {
    promptId: "none",
    kind: "EXECUTE_TESTNET",
    createdAt: new Date(0).toISOString(),
    expiresAt: new Date(0).toISOString(),
    status: "EXPIRED",
    summary: "",
  });

  if (!isPermissionPromptActive(prompt)) {
    await syncTelegramControlChannel({ chatId, sendPermissionPrompt: true });
    const refreshed = await loadTelegramControlState();
    const active = refreshed.lastPermissionPrompt;
    if (!active || !isPermissionPromptActive(active)) {
      return {
        ok: false,
        reply: "No pending permission. Use /status to check mission state.",
      };
    }
    return handleApproveWithPrompt(active, chatId);
  }

  return handleApproveWithPrompt(prompt, chatId);
}

async function handleApproveWithPrompt(
  prompt: NonNullable<Awaited<ReturnType<typeof loadTelegramControlState>>["lastPermissionPrompt"]>,
  chatId: string,
): Promise<TelegramCommandResult> {
  if (!isPermissionPromptActive(prompt)) {
    return { ok: false, reply: "Permission expired. Wait for a new preview or run /start_ai." };
  }

  try {
    let summary = "";
    if (prompt.kind === "EXECUTE_TESTNET") {
      if (!prompt.previewId) {
        return { ok: false, reply: "Execute approval missing previewId." };
      }
      const result = await executeBinanceTestnetOrder({
        execute: {
          previewId: prompt.previewId,
          doubleConfirm: true,
          operatorNote: "Telegram /approve (MVP 77)",
        },
        operatorNote: "Telegram /approve (MVP 77)",
      });
      if (!result.ok) {
        return {
          ok: false,
          reply: `Execute blocked: ${result.error ?? result.journalEntry.blockReasons?.join("; ") ?? "unknown"}`,
        };
      }
      summary = `Testnet order executed · ${result.journalEntry?.symbol ?? prompt.symbol}`;
    } else if (prompt.kind === "CLOSE_TESTNET") {
      if (!prompt.symbol) {
        return { ok: false, reply: "Close approval missing symbol." };
      }
      const result = await executeBinanceTestnetClose({
        close: {
          symbol: prompt.symbol,
          doubleConfirm: true,
          operatorNote: "Telegram /approve close (MVP 77)",
        },
      });
      if (!result.ok) {
        return {
          ok: false,
          reply: `Close blocked: ${result.error ?? "unknown"}`,
        };
      }
      summary = `Reduce-only close submitted · ${prompt.symbol}`;
    } else if (prompt.kind === "LOOP_CONTINUE") {
      await grantSuspiciousLoopPermission();
      summary = "Loop guard cleared — one autopilot cycle may continue.";
    }

    const state = await loadTelegramControlState();
    state.lastPermissionPrompt = { ...prompt, status: "APPROVED" };
    await saveTelegramControlState(state);
    invalidateMissionSnapshotCache();
    await syncTelegramControlChannel({ chatId, sendPermissionPrompt: false });

    return {
      ok: true,
      reply: `Approved ${permissionKindLabel(prompt.kind)}.\n${summary}`,
      permissionHandled: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approve failed";
    return { ok: false, reply: message };
  }
}

async function handleDeny(chatId: string): Promise<TelegramCommandResult> {
  const state = await loadTelegramControlState();
  const prompt = state.lastPermissionPrompt;
  if (!prompt || prompt.status !== "PENDING") {
    return { ok: false, reply: "No pending permission to deny." };
  }
  state.lastPermissionPrompt = { ...prompt, status: "DENIED" };
  await saveTelegramControlState(state);
  await syncTelegramControlChannel({ chatId, sendPermissionPrompt: false });
  return {
    ok: true,
    reply: `Denied ${permissionKindLabel(prompt.kind)}.`,
    permissionHandled: true,
  };
}

export async function handleTelegramCommand(input: {
  command: string;
  chatId: string;
}): Promise<TelegramCommandResult> {
  if (!isTelegramControlEnabled()) {
    return { ok: false, reply: "Telegram control channel is not configured." };
  }

  const cmd = input.command.toLowerCase();
  const state = await loadTelegramControlState();
  state.lastCommandAt = new Date().toISOString();
  await saveTelegramControlState(state);

  switch (cmd) {
    case "/help": {
      return { ok: true, reply: formatHelpMessage() };
    }
    case "/status": {
      const sync = await syncTelegramControlChannel({
        chatId: input.chatId,
        sendPermissionPrompt: true,
      });
      if (!sync.ok) {
        return { ok: false, reply: sync.skipped ?? "Status sync failed." };
      }
      return {
        ok: true,
        reply: "Pinned status updated." + (sync.permissionPromptSent ? " Permission prompt sent." : ""),
      };
    }
    case "/mission": {
      const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
      return { ok: true, reply: formatMissionSummary(snapshot) };
    }
    case "/trades": {
      const trades = await buildGoalTradeListServer();
      return { ok: true, reply: formatTradesSummary(trades) };
    }
    case "/position": {
      const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
      return { ok: true, reply: formatPositionSummary(snapshot) };
    }
    case "/start_ai": {
      const cycle = await runGoalStartAiCycle();
      invalidateMissionSnapshotCache();
      await syncTelegramControlChannel({
        chatId: input.chatId,
        sendPermissionPrompt: true,
      });
      const preview = cycle.testnetPreview;
      const previewLine = preview
        ? `Preview: ${preview.symbol} ${preview.side} · expires ${new Date(preview.expiresAt).toLocaleTimeString()}`
        : "No testnet preview this cycle.";
      return {
        ok: true,
        reply: sanitizeBriefingText(
          [
            `Start AI complete · verdict ${cycle.journalEntry.finalVerdict}`,
            previewLine,
            "Use /approve if permission prompt is active.",
            "Live trading remains locked.",
          ].join("\n"),
        ),
      };
    }
    case "/pause_ai": {
      await pauseAutomation(true);
      invalidateMissionSnapshotCache();
      await syncTelegramControlChannel({ chatId: input.chatId, sendPermissionPrompt: false });
      return { ok: true, reply: "Autopilot paused. Use web or automation settings to resume." };
    }
    case "/approve": {
      return handleApprove(input.chatId);
    }
    case "/deny": {
      return handleDeny(input.chatId);
    }
    case "/report": {
      return { ok: true, reply: await buildMissionDigest() };
    }
    case "/risk": {
      const [{ snapshot }, riskInput] = await Promise.all([
        buildMissionFlowServerSnapshot({ fresh: true }),
        enrichRealTimeRiskInput({ entries: [], orders: [] }),
      ]);
      const report = evaluateRealTimeRisk(riskInput);
      const blockers = report.checks
        .filter((c) => c.status === "FAIL" || c.status === "WARNING" || c.status === "CRITICAL")
        .map((c) => c.label);
      return {
        ok: true,
        reply: formatRiskSummary({
          mission: snapshot,
          riskStatus: report.riskStatus,
          riskBlockers: blockers,
        }),
      };
    }
    default: {
      return {
        ok: false,
        reply: `Unknown command. ${formatHelpMessage()}`,
      };
    }
  }
}

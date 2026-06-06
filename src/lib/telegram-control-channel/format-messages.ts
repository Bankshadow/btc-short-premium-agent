import { sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type { AiStatusCardState } from "@/lib/ai-status/types";
import type { TelegramPermissionPrompt } from "./types";
import { TELEGRAM_COMMANDS } from "./config";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function formatPinnedStatusMessage(input: {
  mission: MissionFlowSnapshot;
  aiCard?: AiStatusCardState | null;
  permission?: TelegramPermissionPrompt | null;
}): string {
  const m = input.mission;
  const ai = input.aiCard;
  const pos = m.currentPosition;
  const actionNeeded =
    m.aiStatus.humanActionRequired ||
    ai?.permissionNeeded ||
    Boolean(input.permission && input.permission.status === "PENDING");

  const lines = [
    "📌 BTC Short Premium · Mission Status",
    "",
    `Goal: ${m.progressPct}% · ${usd(m.currentEquity)} / ${usd(m.targetCapital)}`,
    `PnL: ${usd(m.netPnl)} (real ${usd(m.realizedPnl)} · u ${usd(m.unrealizedPnl)})`,
    pos
      ? `Position: ${pos.symbol} ${pos.side} · uPnL ${usd(pos.unrealizedPnlUsd)}`
      : "Position: flat",
    `AI: ${m.aiStatus.state} · ${m.aiStatus.nextAction}`,
    `Autopilot: ${m.automation.paused ? "PAUSED" : m.automation.enabled ? "ON" : "OFF"} · ${m.automation.intervalMinutes}m`,
    actionNeeded ? "⚠️ Action needed — check permission prompt or /approve" : "✅ No permission pending",
    m.risk.blocker ? `Blocker: ${m.risk.blocker}` : null,
    "",
    `Updated ${new Date(m.lastUpdatedAt).toLocaleString()}`,
    "Live locked · testnet only",
  ];
  return sanitizeBriefingText(lines.filter(Boolean).join("\n"));
}

export function formatMissionSummary(m: MissionFlowSnapshot): string {
  return sanitizeBriefingText(
    [
      "Mission",
      `Progress: ${m.progressPct}% (${usd(m.currentEquity)} / ${usd(m.targetCapital)})`,
      `Trust: ${m.trust.completedTrades}/${m.trust.minRequired} · notional $${m.trustNotionalUsd}`,
      `Trades: ${m.closedTrades} closed · ${m.openTrades} open · win ${m.winRate ?? 0}%`,
      `Verdict: ${m.lastVerdict ?? "—"}`,
      m.nextRecommendation,
      `AI: ${m.aiStatus.state} — ${m.aiStatus.nextAction}`,
    ].join("\n"),
  );
}

export function formatTradesSummary(
  trades: Array<{
    symbol: string;
    side: string;
    pnlUsd: number;
    result: string;
    environment: string;
  }>,
  limit = 6,
): string {
  if (trades.length === 0) return "No trades recorded yet.";
  const rows = trades.slice(0, limit).map(
    (t) =>
      `${t.symbol} ${t.side} · ${t.result} · ${usd(t.pnlUsd)} · ${t.environment}`,
  );
  return sanitizeBriefingText(["Recent trades", ...rows].join("\n"));
}

export function formatPositionSummary(m: MissionFlowSnapshot): string {
  const pos = m.currentPosition;
  if (!pos) return "No open position.";
  return sanitizeBriefingText(
    [
      `Position: ${pos.symbol} ${pos.side}`,
      pos.summary,
      `Entry ${pos.entryPrice} · mark ${pos.markPrice ?? "—"}`,
      `uPnL ${usd(pos.unrealizedPnlUsd)}`,
      pos.canCloseOnTestnet
        ? "Reduce-only close available — use /approve when prompted."
        : "Close not available on testnet.",
    ].join("\n"),
  );
}

export function formatRiskSummary(input: {
  mission: MissionFlowSnapshot;
  riskStatus?: string;
  riskBlockers?: string[];
}): string {
  return sanitizeBriefingText(
    [
      "Risk",
      `Live: locked (${input.mission.risk.liveLocked ? "yes" : "no"})`,
      `Testnet: ${input.mission.risk.testnetStatus}`,
      input.mission.risk.blocker ? `Blocker: ${input.mission.risk.blocker}` : null,
      input.riskStatus ? `Realtime: ${input.riskStatus}` : null,
      ...(input.riskBlockers ?? []).slice(0, 4).map((b) => `· ${b}`),
      "Cannot enable live or increase risk from Telegram.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function formatPermissionPromptMessage(prompt: TelegramPermissionPrompt): string {
  const kindLabel =
    prompt.kind === "EXECUTE_TESTNET"
      ? "Testnet execute"
      : prompt.kind === "CLOSE_TESTNET"
        ? "Reduce-only close"
        : "Loop continue";
  const expires = new Date(prompt.expiresAt).toLocaleTimeString();
  return sanitizeBriefingText(
    [
      `🔐 Permission required · ${kindLabel}`,
      prompt.summary,
      prompt.symbol ? `Symbol: ${prompt.symbol} ${prompt.side ?? ""}`.trim() : null,
      prompt.notionalUsd != null ? `Notional: $${prompt.notionalUsd}` : null,
      `Expires: ${expires}`,
      "",
      "/approve — confirm (double confirm via chat)",
      "/deny — reject",
      "Live trading cannot be enabled from Telegram.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function formatHelpMessage(): string {
  const rows = TELEGRAM_COMMANDS.map((c) => `${c.command} — ${c.description}`);
  return sanitizeBriefingText(["Telegram control (testnet only)", ...rows].join("\n"));
}

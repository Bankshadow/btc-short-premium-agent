import type { SmartBriefingPayload, SmartNotification } from "./types";
import {
  DESK_LABEL_FOR_EVENT,
  EVENT_BRIEFING_TYPE,
  EVENT_PAGE_LINK,
  EVENT_SEVERITY,
  EVENT_TITLES,
} from "./config";

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) return "—";
  return reasons
    .slice(0, 3)
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");
}

export function formatSmartBriefingMessage(payload: SmartBriefingPayload): string {
  const label = payload.deskLabel ?? DESK_LABEL_FOR_EVENT[payload.eventType] ?? "DESK";
  const lines = [
    `━━ BTC Desk · ${label} ━━`,
    `Event: ${EVENT_TITLES[payload.eventType]}`,
    `Status: ${payload.status ?? "—"}`,
    `Verdict: ${payload.verdict ?? "—"}`,
    `Action: ${payload.recommendedAction ?? "—"}`,
    "",
    "Top reasons:",
    formatReasons(payload.topReasons ?? []),
  ];
  if (payload.blocker) {
    lines.push("", `Blocker: ${payload.blocker}`);
  }
  if (payload.body) {
    lines.push("", payload.body);
  }
  const href = payload.linkHref ?? EVENT_PAGE_LINK[payload.eventType];
  lines.push("", `→ ${href}`, "", "Advisory only · no auto-execution.");
  return lines.join("\n");
}

export function buildSmartNotification(
  payload: SmartBriefingPayload,
  channelResults: Record<string, boolean | string> = {},
): SmartNotification {
  const id = `sn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const at = new Date().toISOString();
  const attempted = Object.keys(channelResults);
  const delivered = attempted.filter((k) => channelResults[k] === true);

  return {
    id,
    eventType: payload.eventType,
    briefingType: payload.briefingType ?? EVENT_BRIEFING_TYPE[payload.eventType],
    severity: payload.severity ?? EVENT_SEVERITY[payload.eventType],
    actionRequired: payload.actionRequired ?? false,
    status: "UNREAD",
    deskLabel: payload.deskLabel ?? DESK_LABEL_FOR_EVENT[payload.eventType] ?? "DESK",
    title: payload.title ?? EVENT_TITLES[payload.eventType],
    message: payload.body ?? formatSmartBriefingMessage(payload),
    verdict: payload.verdict ?? null,
    recommendedAction: payload.recommendedAction ?? null,
    topReasons: payload.topReasons ?? [],
    blocker: payload.blocker ?? null,
    linkHref: payload.linkHref ?? EVENT_PAGE_LINK[payload.eventType],
    channelsAttempted: ["in_app", ...attempted],
    channelsDelivered: ["in_app", ...delivered],
    createdAt: at,
    readAt: null,
    resolvedAt: null,
  };
}

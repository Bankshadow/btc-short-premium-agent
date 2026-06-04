import type { AgentRecommendation } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { formatDeskBriefing } from "@/lib/notify/format-desk-briefing";
import { formatVerdictAlertBody } from "./verdict-templates";

const BANGKOK_TZ = "Asia/Bangkok";

/** Quiet hours 22:00–08:00 Bangkok — skip routine pings unless veto. */
export function isBangkokQuietHours(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BANGKOK_TZ,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return hour >= 22 || hour < 8;
}

export function shouldSendRoutineAlert(
  data: AnalyzeApiResponse,
  options?: { quietHoursEnabled?: boolean },
): boolean {
  const veto = data.tradingDesk?.committee.riskVeto ?? false;
  if (veto) return true;
  if (options?.quietHoursEnabled !== false && isBangkokQuietHours()) {
    return false;
  }
  return true;
}

export function formatRoutedCronMessage(
  data: AnalyzeApiResponse,
  options?: { quietHoursEnabled?: boolean; useBriefing?: boolean },
): string {
  const verdict: AgentRecommendation =
    data.tradingDesk?.committee.finalVerdict ?? "WAIT";
  const veto = data.tradingDesk?.committee.riskVeto ?? false;

  if (options?.useBriefing) {
    return formatDeskBriefing(data);
  }

  if (veto) {
    return formatVerdictAlertBody(data, { includeBriefing: true });
  }

  if (verdict === "TRADE") {
    return formatVerdictAlertBody(data, { includeBriefing: true });
  }

  if (!shouldSendRoutineAlert(data, options)) {
    return "";
  }

  return formatVerdictAlertBody(data);
}

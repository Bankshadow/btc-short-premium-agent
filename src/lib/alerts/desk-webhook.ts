import type { AnalyzeApiResponse } from "@/lib/types/market";

export interface DeskWebhookPayload {
  event: "desk.analyze" | "desk.trade";
  timestamp: string;
  verdict: string;
  riskVeto: boolean;
  btcPrice: number;
  marketRegime: string;
  topReasons: string[];
  action: string;
  suggestedSizePct: number;
  paperAutoOpen: boolean;
}

export function buildDeskWebhookPayload(
  data: AnalyzeApiResponse,
): DeskWebhookPayload {
  const desk = data.tradingDesk;
  return {
    event:
      desk?.committee.finalVerdict === "TRADE" && !desk.committee.riskVeto
        ? "desk.trade"
        : "desk.analyze",
    timestamp: data.step5_verdict.analyzedAt,
    verdict: desk?.committee.finalVerdict ?? "WAIT",
    riskVeto: desk?.committee.riskVeto ?? false,
    btcPrice: data.step1_marketSnapshot.spotPrice,
    marketRegime: desk?.marketRegime ?? "—",
    topReasons: desk?.committee.topReasons ?? [],
    action: data.step6_actionPlan.action,
    suggestedSizePct: data.step6_actionPlan.suggestedSizePct,
    paperAutoOpen:
      desk?.committee.finalVerdict === "TRADE" && !desk?.committee.riskVeto,
  };
}

export async function postDeskWebhook(
  data: AnalyzeApiResponse,
  url?: string,
): Promise<boolean> {
  const target = url?.trim() || process.env.DESK_WEBHOOK_URL?.trim();
  if (!target) return false;

  const payload = buildDeskWebhookPayload(data);
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Desk webhook failed: ${response.status} ${text}`);
  }
  return true;
}

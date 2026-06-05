import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import { buildDeskHealth } from "@/lib/operator/desk-health";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isCronSecretConfigured, isTestAutomationAllowed } from "@/lib/cron/cron-auth";
import type { ServerReadinessContext } from "./types";
import { LIVE_READINESS_THRESHOLDS } from "./thresholds";

function parseMaxLiveNotional(): number {
  const raw = process.env.LIVE_MAX_NOTIONAL_USD?.trim();
  const parsed = raw ? Number(raw) : LIVE_READINESS_THRESHOLDS.defaultMaxLiveNotionalUsd;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : LIVE_READINESS_THRESHOLDS.defaultMaxLiveNotionalUsd;
}

export async function buildServerReadinessContext(): Promise<ServerReadinessContext> {
  const exchangeStatus = await buildExchangeStatus();
  const liveExecution = liveExecutionStatus();
  const deskHealth = buildDeskHealth(null);

  return {
    exchangeStatus,
    liveExecution,
    maxLiveNotionalUsd: parseMaxLiveNotional(),
    cronSecretConfigured: isCronSecretConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    telegramConfigured: deskHealth.telegramConfigured,
    discordEnvConfigured: deskHealth.discordEnvConfigured,
    deskWebhookConfigured: deskHealth.deskWebhookConfigured,
    llmConfigured: deskHealth.llmNarratorConfigured,
    serverAutomationAllowed: isTestAutomationAllowed(),
    timestamp: new Date().toISOString(),
  };
}

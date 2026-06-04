import type { AnalyzeApiResponse } from "@/lib/types/market";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export interface DeskHealthSnapshot {
  riskProfile: string;
  supabaseConfigured: boolean;
  telegramConfigured: boolean;
  discordEnvConfigured: boolean;
  deskWebhookConfigured: boolean;
  llmNarratorConfigured: boolean;
  cronSecretConfigured: boolean;
  lastVerdict: string | null;
  lastAnalyzedAt: string | null;
  lastRiskVeto: boolean;
  sourceErrorCount: number;
  openPaperCount: number;
}

export function buildDeskHealth(
  data: AnalyzeApiResponse | null,
  options?: { openPaperCount?: number },
): DeskHealthSnapshot {
  const desk = data?.tradingDesk;
  return {
    riskProfile: getDeskRiskProfile(),
    supabaseConfigured: isSupabaseConfigured(),
    telegramConfigured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() &&
        process.env.TELEGRAM_CHAT_ID?.trim(),
    ),
    discordEnvConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
    deskWebhookConfigured: Boolean(process.env.DESK_WEBHOOK_URL?.trim()),
    llmNarratorConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    lastVerdict: desk?.committee.finalVerdict ?? null,
    lastAnalyzedAt: data?.step5_verdict.analyzedAt ?? null,
    lastRiskVeto: desk?.committee.riskVeto ?? false,
    sourceErrorCount: data?.sourceErrors?.length ?? 0,
    openPaperCount: options?.openPaperCount ?? 0,
  };
}

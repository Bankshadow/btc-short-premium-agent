"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import {
  loadDeskSettings,
  saveDeskSettings,
  type DeskCloudSettings,
} from "@/lib/desk/desk-settings";
import {
  getOverrideForLog,
  saveOperatorOverride,
} from "@/lib/operator/operator-override";
import { buildDeskHealth } from "@/lib/operator/desk-health";
import { useCallback, useEffect, useMemo, useState } from "react";

interface OperatorDeskPanelProps {
  data: AnalyzeApiResponse | null;
  lastLogId: string | null;
  openPaperCount: number;
  onRiskProfileChange: () => void;
}

export default function OperatorDeskPanel({
  data,
  lastLogId,
  openPaperCount,
  onRiskProfileChange,
}: OperatorDeskPanelProps) {
  const [settings, setSettings] = useState<DeskCloudSettings>(loadDeskSettings);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideVerdict, setOverrideVerdict] =
    useState<AgentRecommendation>("WAIT");
  const [alertTestStatus, setAlertTestStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [serverHealth, setServerHealth] = useState<ReturnType<
    typeof buildDeskHealth
  > | null>(null);

  const health = useMemo(
    () => buildDeskHealth(data, { openPaperCount }),
    [data, openPaperCount],
  );

  useEffect(() => {
    if (lastLogId) {
      const existing = getOverrideForLog(lastLogId);
      if (existing) {
        setOverrideReason(existing.reason);
        setOverrideVerdict(existing.disagreeWithVerdict);
      }
    }
  }, [lastLogId]);

  const patchSettings = (patch: Partial<DeskCloudSettings>) => {
    const next = saveDeskSettings(patch);
    setSettings(next);
    if (patch.riskProfile) onRiskProfileChange();
  };

  const saveOverride = () => {
    if (!lastLogId || !overrideReason.trim()) return;
    saveOperatorOverride({
      logEntryId: lastLogId,
      disagreeWithVerdict: overrideVerdict,
      reason: overrideReason.trim(),
      createdAt: new Date().toISOString(),
    });
    setAlertTestStatus("Operator override saved (audit only).");
  };

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/desk/health", { cache: "no-store" });
      const json = (await res.json()) as { health?: ReturnType<typeof buildDeskHealth> };
      setServerHealth(json.health ?? null);
    } catch {
      setServerHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const testAlerts = async () => {
    setAlertTestStatus("Sending…");
    try {
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordWebhookUrl: settings.discordWebhookUrl || undefined,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(json.error ?? res.status));
      setAlertTestStatus(
        [
          json.telegramSent && "Telegram OK",
          json.discordSent && "Discord OK",
          json.telegramError && `TG: ${json.telegramError}`,
          json.discordError && `DC: ${json.discordError}`,
        ]
          .filter(Boolean)
          .join(" · ") || "Done",
      );
    } catch (e) {
      setAlertTestStatus(e instanceof Error ? e.message : "Test failed");
    }
  };

  return (
    <section className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-3">
      <p className="desk-section-title text-violet-400/90">Operator desk · MVP 9</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">
          Risk profile
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            value={settings.riskProfile}
            onChange={(e) =>
              patchSettings({ riskProfile: e.target.value as DeskRiskProfile })
            }
          >
            <option value="aggressive">Aggressive (more TRADE)</option>
            <option value="balanced">Balanced (playbook strict)</option>
          </select>
        </label>

        <div className="flex flex-col gap-2 text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.alertQuietHours}
              onChange={(e) =>
                patchSettings({ alertQuietHours: e.target.checked })
              }
            />
            Cron quiet hours 22:00–08:00 BKK (veto always pings)
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[10px] text-zinc-500 sm:grid-cols-3">
        <span>Supabase: {health.supabaseConfigured ? "on" : "off"}</span>
        <span>Telegram: {health.telegramConfigured ? "on" : "off"}</span>
        <span>Webhook: {health.deskWebhookConfigured ? "on" : "off"}</span>
        <span>LLM narrator: {health.llmNarratorConfigured ? "on" : "off"}</span>
        <span>Last: {health.lastVerdict ?? "—"}</span>
        <span>Open paper: {openPaperCount}</span>
      </div>

      <button
        type="button"
        onClick={() => void fetchHealth()}
        disabled={healthLoading}
        className="mt-2 text-[10px] text-violet-400 hover:underline"
      >
        {healthLoading ? "Loading server health…" : "Refresh server health"}
      </button>
      {serverHealth && (
        <p className="mt-1 text-[10px] text-zinc-600">
          Server risk: {serverHealth.riskProfile} · cron secret:{" "}
          {serverHealth.cronSecretConfigured ? "yes" : "no"}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void testAlerts()}
          className="rounded bg-violet-800/80 px-2.5 py-1 text-[10px] font-medium text-zinc-100"
        >
          Test alert templates
        </button>
      </div>

      <label className="mt-2 block text-xs text-zinc-500">
        Discord webhook (optional, local)
        <input
          type="url"
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-300"
          placeholder="https://discord.com/api/webhooks/…"
          value={settings.discordWebhookUrl}
          onChange={(e) =>
            patchSettings({ discordWebhookUrl: e.target.value })
          }
        />
      </label>

      {alertTestStatus && (
        <p className="mt-2 text-[10px] text-zinc-500">{alertTestStatus}</p>
      )}

      {lastLogId && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="text-xs font-medium text-zinc-400">Operator override (audit)</p>
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            value={overrideVerdict}
            onChange={(e) =>
              setOverrideVerdict(e.target.value as AgentRecommendation)
            }
          >
            <option value="TRADE">Disagree — expected TRADE</option>
            <option value="SKIP">Disagree — expected SKIP</option>
            <option value="WAIT">Disagree — expected WAIT</option>
          </select>
          <textarea
            className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300"
            rows={2}
            placeholder="Reason (required)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <button
            type="button"
            onClick={saveOverride}
            disabled={!overrideReason.trim()}
            className="mt-2 rounded bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-200 disabled:opacity-40"
          >
            Save override for last session
          </button>
        </div>
      )}
    </section>
  );
}

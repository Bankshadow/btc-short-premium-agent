import { readScopedJson, writeScopedJson } from "@/lib/platform/scoped-storage";
import type { DeskRiskProfile } from "./desk-risk-policy";

export const DESK_SETTINGS_STORAGE_KEY =
  "trading-agents-crypto-desk:desk-settings";

export interface DeskCloudSettings {
  syncJournalSupabase: boolean;
  /** Live trading readiness — audit trail for pilot actions */
  auditLiveActions: boolean;
  /** MVP 9 — sent with analyze requests */
  riskProfile: DeskRiskProfile;
  /** MVP 9 — 22–08 Bangkok quiet hours (no non-veto pings) */
  alertQuietHours: boolean;
  /** MVP 9 — optional Discord webhook URL (client-stored, dev only) */
  discordWebhookUrl: string;
}

export const DEFAULT_DESK_SETTINGS: DeskCloudSettings = {
  syncJournalSupabase: true,
  auditLiveActions: true,
  riskProfile: "aggressive",
  alertQuietHours: true,
  discordWebhookUrl: "",
};

export function loadDeskSettings(): DeskCloudSettings {
  if (typeof window === "undefined") return DEFAULT_DESK_SETTINGS;
  try {
    return { ...DEFAULT_DESK_SETTINGS, ...readScopedJson("desk-settings", {}) };
  } catch {
    return DEFAULT_DESK_SETTINGS;
  }
}

export function saveDeskSettings(
  patch: Partial<DeskCloudSettings>,
): DeskCloudSettings {
  const next = { ...loadDeskSettings(), ...patch };
  writeScopedJson("desk-settings", next);
  return next;
}

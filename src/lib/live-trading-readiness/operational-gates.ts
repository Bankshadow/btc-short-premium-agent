import type { CommandCenterReport } from "@/lib/command-center/types";
import type { DeskCloudSettings } from "@/lib/desk/desk-settings";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";
import type { OperationalGateSnapshot } from "./types";

export const KILL_SWITCH_TESTED_KEY = "btc-desk:kill-switch-tested-at";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function markKillSwitchTested(): void {
  if (!isBrowser()) return;
  localStorage.setItem(KILL_SWITCH_TESTED_KEY, new Date().toISOString());
}

export function isKillSwitchTested(): boolean {
  if (!isBrowser()) return false;
  return Boolean(localStorage.getItem(KILL_SWITCH_TESTED_KEY));
}

export function buildOperationalGates(input: {
  deskSettings?: DeskCloudSettings;
  serverContext: ServerReadinessContext;
  commandCenter?: CommandCenterReport | null;
  realTimeRisk?: RealTimeRiskReport | null;
  auditEnabled?: boolean;
  alertsGovernanceOff?: boolean;
  killSwitchTested?: boolean;
}): OperationalGateSnapshot {
  const desk = input.deskSettings;
  const syncEnabled = desk?.syncJournalSupabase ?? true;
  const syncHealthy = !syncEnabled || input.serverContext.supabaseConfigured;
  const auditEnabled = input.auditEnabled ?? true;
  const auditHealthy = auditEnabled;
  const alertsEnabled =
    !input.alertsGovernanceOff &&
    (input.serverContext.telegramConfigured ||
      input.serverContext.discordEnvConfigured ||
      input.serverContext.deskWebhookConfigured ||
      Boolean(desk?.discordWebhookUrl?.trim()));
  const killSwitchTested = input.killSwitchTested ?? isKillSwitchTested();
  const commandCenterStatus = input.commandCenter?.status ?? "UNKNOWN";
  const realTimeRiskStatus = input.realTimeRisk?.riskStatus ?? "UNKNOWN";
  const exchangeConnected = input.serverContext.exchangeStatus.connected;

  const blockers: string[] = [];
  if (!syncEnabled) blockers.push("Journal sync disabled in desk settings.");
  if (syncEnabled && !input.serverContext.supabaseConfigured) {
    blockers.push("Sync enabled but Supabase not configured.");
  }
  if (!auditEnabled) blockers.push("Live action audit logging disabled.");
  if (!alertsEnabled) blockers.push("No alert channel configured or alerts disabled.");
  if (!killSwitchTested) {
    blockers.push("Kill switch not tested — toggle emergency stop once on /live-pilot.");
  }
  if (commandCenterStatus === "BLOCKED") {
    blockers.push("Command center status BLOCKED.");
  }
  if (commandCenterStatus === "EMERGENCY") {
    blockers.push("Command center EMERGENCY — resolve before live.");
  }
  if (realTimeRiskStatus === "BLOCKED" || realTimeRiskStatus === "EMERGENCY") {
    blockers.push(`Real-time risk ${realTimeRiskStatus}.`);
  }
  if (!exchangeConnected && input.serverContext.exchangeStatus.configured) {
    blockers.push("Exchange configured but disconnected.");
  }
  if (!input.serverContext.exchangeStatus.configured) {
    blockers.push("Exchange not configured.");
  }

  return {
    syncEnabled,
    syncHealthy,
    auditEnabled,
    auditHealthy,
    alertsEnabled,
    killSwitchTested,
    commandCenterStatus,
    realTimeRiskStatus,
    exchangeConnected,
    blockers,
  };
}

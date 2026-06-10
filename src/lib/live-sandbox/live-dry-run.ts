import { getEvents } from "@/lib/journal/journal-query";
import { runLiveDryRun, runLivePreflight } from "./live-preflight";
import type { LiveSandboxStatus } from "./live-sandbox-types";

export { runLiveDryRun };

export async function getLiveSandboxStatus(): Promise<LiveSandboxStatus> {
  const events = await getEvents();
  const lastPreflight = [...events]
    .filter((e) => e.type === "LIVE_PREFLIGHT_CHECKED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const lastDryRun = [...events]
    .filter((e) => e.type === "LIVE_DRY_RUN_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const liveEnvPresent = Boolean(process.env.BINANCE_LIVE_ENABLED?.trim());
  const blockers = ["LIVE_LOCKED_BY_POLICY"];

  return {
    liveLocked: true,
    liveEnvPresent,
    liveEnvDisabledByPolicy: true,
    policyLocked: true,
    lastPreflightAt: lastPreflight?.timestamp ?? null,
    lastDryRunAt: lastDryRun?.timestamp ?? null,
    blockers,
    message: "Micro-live sandbox is dry-run only. No real orders.",
  };
}

export async function runLiveSandboxPreflight() {
  return runLivePreflight();
}

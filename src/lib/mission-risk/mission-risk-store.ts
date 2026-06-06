import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import {
  applyDeskRiskProfile,
  getDeskRiskProfile,
  setDeskRiskProfile,
  type DeskRiskProfile,
} from "@/lib/desk/desk-risk-policy";

const SETTINGS_FILE = "mission-risk-settings.json";

export interface MissionRiskSettings {
  deskRiskProfile: DeskRiskProfile;
}

function settingsPath(): string {
  return path.join(getCronDataDir(), SETTINGS_FILE);
}

function resolveDefaultProfile(): DeskRiskProfile {
  return process.env.DESK_RISK_PROFILE === "balanced" ? "balanced" : "aggressive";
}

export async function loadMissionRiskSettings(): Promise<MissionRiskSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<MissionRiskSettings>;
    const profile =
      parsed.deskRiskProfile === "balanced" || parsed.deskRiskProfile === "aggressive"
        ? parsed.deskRiskProfile
        : resolveDefaultProfile();
    applyDeskRiskProfile(profile);
    return { deskRiskProfile: profile };
  } catch {
    const profile = resolveDefaultProfile();
    applyDeskRiskProfile(profile);
    return { deskRiskProfile: profile };
  }
}

export async function saveMissionRiskSettings(
  patch: Partial<MissionRiskSettings>,
): Promise<MissionRiskSettings> {
  const current = await loadMissionRiskSettings();
  const next: MissionRiskSettings = {
    deskRiskProfile: patch.deskRiskProfile ?? current.deskRiskProfile,
  };
  setDeskRiskProfile(next.deskRiskProfile);
  const filePath = settingsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function readMissionRiskProfileSync(): DeskRiskProfile {
  return getDeskRiskProfile();
}

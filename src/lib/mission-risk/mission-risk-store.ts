import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
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

function resolveDefaultProfile(): DeskRiskProfile {
  return process.env.DESK_RISK_PROFILE === "balanced" ? "balanced" : "aggressive";
}

export async function loadMissionRiskSettings(): Promise<MissionRiskSettings> {
  const parsed = await readCronJsonFile<Partial<MissionRiskSettings>>(
    SETTINGS_FILE,
    {},
  );
  const profile =
    parsed.deskRiskProfile === "balanced" || parsed.deskRiskProfile === "aggressive"
      ? parsed.deskRiskProfile
      : resolveDefaultProfile();
  applyDeskRiskProfile(profile);
  return { deskRiskProfile: profile };
}

export async function saveMissionRiskSettings(
  patch: Partial<MissionRiskSettings>,
): Promise<MissionRiskSettings> {
  const current = await loadMissionRiskSettings();
  const next: MissionRiskSettings = {
    deskRiskProfile: patch.deskRiskProfile ?? current.deskRiskProfile,
  };
  setDeskRiskProfile(next.deskRiskProfile);
  await writeCronJsonFile(SETTINGS_FILE, next);
  return next;
}

export function readMissionRiskProfileSync(): DeskRiskProfile {
  return getDeskRiskProfile();
}

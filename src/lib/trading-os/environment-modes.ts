import type { EnvironmentMode, ModeEffects } from "./trading-os-types";
import type { DeskProfileId } from "./trading-os-types";
import { getDeskProfile } from "./desk-profiles";

export const ENVIRONMENT_MODE_LABELS: Record<EnvironmentMode, string> = {
  DEMO: "Demo",
  PAPER: "Paper",
  SEMI_LIVE: "Semi-live",
  SAFE_MODE: "Safe mode",
};

export function resolveModeEffects(
  mode: EnvironmentMode,
  profileId?: DeskProfileId,
): ModeEffects {
  const profile = profileId ? getDeskProfile(profileId) : null;

  switch (mode) {
    case "DEMO":
      return {
        allowMockFallback: true,
        allowPaperAutoOpen: false,
        allowOrderTickets: false,
        requireHumanApproval: true,
        forceGovernanceSafeMode: false,
        allowLivePlaceholder: false,
        analysisOnlyLabel: "Demo — mock tape allowed when Bybit unavailable",
      };
    case "PAPER":
      return {
        allowMockFallback: false,
        allowPaperAutoOpen: true,
        allowOrderTickets: false,
        requireHumanApproval: false,
        forceGovernanceSafeMode: false,
        allowLivePlaceholder: false,
        analysisOnlyLabel: "Paper — hypothetical orders only, no trade tickets",
      };
    case "SEMI_LIVE":
      return {
        allowMockFallback: false,
        allowPaperAutoOpen: profile?.id === "paper_trading_lab",
        allowOrderTickets: true,
        requireHumanApproval: true,
        forceGovernanceSafeMode: false,
        allowLivePlaceholder: true,
        analysisOnlyLabel: "Semi-live — human-approved tickets, no exchange execution",
      };
    case "SAFE_MODE":
    default:
      return {
        allowMockFallback: false,
        allowPaperAutoOpen: false,
        allowOrderTickets: false,
        requireHumanApproval: true,
        forceGovernanceSafeMode: true,
        allowLivePlaceholder: false,
        analysisOnlyLabel: "Safe — analysis and WAIT/SKIP only",
      };
  }
}

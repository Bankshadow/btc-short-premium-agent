import { isLiveEnabled } from "@/lib/risk/risk-gate";

export function checkLiveLockGuard(): { blocked: boolean; reason: string | null } {
  if (isLiveEnabled()) {
    return { blocked: true, reason: "Live trading is locked — BINANCE_LIVE_ENABLED must be false." };
  }
  return { blocked: false, reason: null };
}

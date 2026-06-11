import { isCoreHealthBlockingExecution } from "@/lib/core/core-health";

export async function checkCoreHealthGuard(): Promise<{ blocked: boolean; reason: string | null }> {
  const blocked = await isCoreHealthBlockingExecution();
  return {
    blocked,
    reason: blocked ? "Core health BLOCKED — resolve blocking issues before execute/close." : null,
  };
}

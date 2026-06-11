import { isEngineExecutionBlocked } from "@/lib/health/engine-health-check";

export async function checkEngineHealthGuard(): Promise<{ blocked: boolean; reason: string | null }> {
  const blocked = await isEngineExecutionBlocked();
  return {
    blocked,
    reason: blocked ? "Engine health blocked — execution disabled." : null,
  };
}

import { isOperatorBlocked, hydrateOperatorGateState } from "@/lib/operator/operator-actions";

export async function checkOperatorGuard(): Promise<{ blocked: boolean; reason: string | null }> {
  await hydrateOperatorGateState();
  const result = await isOperatorBlocked();
  return { blocked: result.blocked, reason: result.reason ?? null };
}

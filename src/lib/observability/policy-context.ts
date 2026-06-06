import { buildPolicyInput } from "@/lib/policy-engine/build-context";
import type { PolicyInput } from "@/lib/policy-engine/types";
import { buildObservabilitySnapshot } from "./build-snapshot";
import { observabilityToPolicyState } from "./observability-blockers";

type BuildPolicyParams = Parameters<typeof buildPolicyInput>[0];

export async function buildPolicyInputWithObservability(
  input: BuildPolicyParams,
): Promise<PolicyInput> {
  const report = await buildObservabilitySnapshot(input.workspaceId, {
    useCache: true,
    promoteIncidents: false,
  });
  return buildPolicyInput({
    ...input,
    observability: observabilityToPolicyState(report),
  });
}

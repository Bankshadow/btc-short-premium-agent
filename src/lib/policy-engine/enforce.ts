import { appendPolicyDecision } from "./audit-store";
import { evaluatePolicy, policyBlockedMessage } from "./evaluate";
import type { PolicyInput, PolicyResult } from "./types";

export function enforcePolicy(
  input: PolicyInput,
): { ok: true; result: PolicyResult } | { ok: false; result: PolicyResult; error: string; status: number } {
  const result = evaluatePolicy(input);
  void appendPolicyDecision(result, input.userRole);

  if (result.decision === "ALLOW") {
    return { ok: true, result };
  }

  const status =
    result.decision === "REQUIRE_APPROVAL" || result.decision === "REQUIRE_MORE_DATA"
      ? 422
      : 403;

  return {
    ok: false,
    result,
    error: policyBlockedMessage(result),
    status,
  };
}

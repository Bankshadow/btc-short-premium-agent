import type { CommandCenterBlocker } from "@/lib/command-center/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { WorkspaceRole } from "@/lib/platform/types";
import { buildPolicyInput } from "./build-context";
import { evaluatePolicy } from "./evaluate";
import type { PolicyActionType } from "./types";

const LIVE_POLICY_ACTIONS: PolicyActionType[] = [
  "PREVIEW_LIVE_ORDER",
  "EXECUTE_LIVE_PERP",
  "EXECUTE_OPTIONS_TESTNET",
];

function policyBlocker(
  action: PolicyActionType,
  detail: string,
): CommandCenterBlocker {
  return {
    id: "policy_engine_block",
    label: `Policy: ${action}`,
    detail,
    hard: true,
  };
}

export function policyCommandCenterBlockers(input: {
  workspaceId?: string;
  userRole?: WorkspaceRole;
  environmentMode?: string;
  latestAnalysis?: AnalyzeApiResponse | null;
  governance?: GovernanceDeskState | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: DeskRiskProfile;
  backboneHealthy?: boolean;
  auditAvailable?: boolean;
}): CommandCenterBlocker[] {
  const blockers: CommandCenterBlocker[] = [];

  for (const action of LIVE_POLICY_ACTIONS) {
    const result = evaluatePolicy(
      buildPolicyInput({
        workspaceId: input.workspaceId ?? "default-ws",
        userRole: input.userRole ?? "TRADER",
        environmentMode: input.environmentMode ?? "PAPER",
        action,
        latestAnalysis: input.latestAnalysis,
        governance: input.governance,
        entries: input.entries,
        orders: input.orders,
        riskProfile: input.riskProfile,
        backboneHealthy: input.backboneHealthy,
        auditAvailable: input.auditAvailable,
        operatorApproval: action === "EXECUTE_LIVE_PERP" ? false : undefined,
      }),
    );

    if (result.decision === "BLOCK" && result.blockers.length > 0) {
      blockers.push(
        policyBlocker(action, result.blockers[0] ?? "Policy blocked live action."),
      );
    }
  }

  return blockers;
}

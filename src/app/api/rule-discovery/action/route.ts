import {
  approveDiscoveredRulePure,
  simulateProposalImpact,
} from "@/lib/rule-discovery";
import { RULE_DISCOVERY_SAFETY_NOTICE } from "@/lib/rule-discovery/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActionBody = {
  action: "approve" | "reject" | "edit" | "simulate";
  proposalId: string;
  proposal?: AutoDiscoveredRuleProposal;
  reviewerNote?: string;
  editedCondition?: string;
  linkStrategyId?: StrategyId;
  activate?: boolean;
  entries?: DecisionLogEntry[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;

    if (!body.proposalId || !body.action) {
      return NextResponse.json(
        { ok: false, error: "proposalId and action required" },
        { status: 400 },
      );
    }

    const proposal = body.proposal;
    if (!proposal && body.action !== "simulate") {
      return NextResponse.json(
        { ok: false, error: "proposal object required in body" },
        { status: 400 },
      );
    }

    switch (body.action) {
      case "approve": {
        const result = approveDiscoveredRulePure(proposal!, {
          proposalId: body.proposalId,
          reviewerNote: body.reviewerNote,
          editedCondition: body.editedCondition,
          linkStrategyId: body.linkStrategyId,
          activate: body.activate,
        });
        if (!result) {
          return NextResponse.json(
            { ok: false, error: "Proposal not approvable" },
            { status: 422 },
          );
        }
        return NextResponse.json({
          ok: true,
          proposal: result.proposal,
          draftRule: result.draftRule,
          clientMustPersist: true,
          safetyNotice: RULE_DISCOVERY_SAFETY_NOTICE,
        });
      }
      case "reject": {
        const updated: AutoDiscoveredRuleProposal = {
          ...proposal!,
          lifecycle: "rejected",
          reviewerNote: body.reviewerNote ?? "Rejected by operator",
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return NextResponse.json({
          ok: true,
          proposal: updated,
          clientMustPersist: true,
        });
      }
      case "edit": {
        const updated: AutoDiscoveredRuleProposal = {
          ...proposal!,
          editedCondition: body.editedCondition ?? proposal!.editedCondition,
          reviewerNote: body.reviewerNote ?? proposal!.reviewerNote,
          updatedAt: new Date().toISOString(),
        };
        return NextResponse.json({
          ok: true,
          proposal: updated,
          clientMustPersist: true,
        });
      }
      case "simulate": {
        if (!proposal) {
          return NextResponse.json(
            { ok: false, error: "proposal required for simulate" },
            { status: 400 },
          );
        }
        const impact = simulateProposalImpact({
          proposal,
          entries: body.entries ?? [],
        });
        return NextResponse.json({ ok: true, impact, advisoryOnly: true });
      }
      default:
        return NextResponse.json(
          { ok: false, error: "Unknown action" },
          { status: 400 },
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rule discovery action failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

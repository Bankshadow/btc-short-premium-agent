import { createStrategyExperiment } from "@/lib/strategy-experiments/create-experiment";
import {
  experimentFromCouncilProposal,
  experimentFromMemoryLesson,
  experimentFromRuleDiscovery,
  experimentFromSelfLearning,
  experimentFromUserHypothesis,
} from "@/lib/strategy-experiments/create-from-sources";
import { EXPERIMENT_SAFETY_NOTICE } from "@/lib/strategy-experiments/types";
import type { CreateExperimentInput } from "@/lib/strategy-experiments/types";
import type { CouncilProposal } from "@/lib/council/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { ImprovementRecommendation } from "@/lib/self-learning/types";
import type { RelevantMemoryLesson } from "@/lib/memory-graph/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateBody = {
  direct?: CreateExperimentInput;
  councilProposal?: CouncilProposal;
  ruleDiscovery?: AutoDiscoveredRuleProposal;
  selfLearning?: ImprovementRecommendation;
  memoryLesson?: RelevantMemoryLesson;
  userHypothesis?: {
    summary: string;
    expectedOutcome: string;
    variant?: CreateExperimentInput["variant"];
    mode?: CreateExperimentInput["mode"];
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBody;
    let experiment;

    if (body.councilProposal) {
      experiment = experimentFromCouncilProposal(body.councilProposal);
    } else if (body.ruleDiscovery) {
      experiment = experimentFromRuleDiscovery(body.ruleDiscovery);
    } else if (body.selfLearning) {
      experiment = experimentFromSelfLearning(body.selfLearning);
      if (!experiment) {
        return NextResponse.json(
          { ok: false, error: "Self-learning item not suitable for experiment" },
          { status: 400 },
        );
      }
    } else if (body.memoryLesson) {
      experiment = experimentFromMemoryLesson(body.memoryLesson);
    } else if (body.userHypothesis) {
      experiment = experimentFromUserHypothesis(body.userHypothesis);
    } else if (body.direct) {
      experiment = createStrategyExperiment(body.direct);
    } else {
      return NextResponse.json(
        { ok: false, error: "No experiment source provided" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      experiment,
      clientMustPersist: true,
      cannotPlaceLiveTrades: true,
      cannotChangeActiveWithoutApproval: true,
      safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Experiment create failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

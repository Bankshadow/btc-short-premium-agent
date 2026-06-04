import type { AnalyzeApiResponse, DecisionEngineInput } from "@/lib/types/market";
import type { CommitteeVerdict } from "@/lib/agents/types";
import { buildOrderTicket } from "@/lib/trade-control/build-order-ticket";
import { runPreMortemAgent } from "./pre-mortem-agent";
import type { PreMortemResult, LearningSnapshot } from "./types";

function buildLearningSnapshot(
  data: AnalyzeApiResponse,
): LearningSnapshot | undefined {
  if (!data.dataTrust || !data.conflictAnalysis) return undefined;
  return {
    dataTrustScore: data.dataTrust.score,
    dataTrustGrade: data.dataTrust.grade,
    conflictScore: data.conflictAnalysis.conflictScore,
    conflictLevel: data.conflictAnalysis.conflictLevel,
  };
}

export function applyPreMortemToAnalyzeResponse(
  engineInput: DecisionEngineInput,
  response: AnalyzeApiResponse,
  decisionLogId: string,
): AnalyzeApiResponse {
  if (!response.tradingDesk) return response;

  const desk = response.tradingDesk;
  const ticketPreview = buildOrderTicket(response, decisionLogId);

  const preMortem = runPreMortemAgent({
    market: response.step1_marketSnapshot,
    agentOutputs: desk.agents,
    riskManager: desk.riskManager,
    committee: desk.committee,
    dataTrust: response.dataTrust,
    conflict: response.conflictAnalysis,
    conflictGate: response.conflictGate,
    actionPlan: response.step6_actionPlan,
    orderTicketCandidate: ticketPreview,
    analyzedAt: response.step5_verdict.analyzedAt,
  });

  let committee: CommitteeVerdict = desk.committee;
  if (
    preMortem.preMortemVerdict === "BLOCK" &&
    committee.finalVerdict === "TRADE"
  ) {
    committee = {
      ...committee,
      finalVerdict: "WAIT",
      consensusSummary: `${committee.consensusSummary} Pre-mortem BLOCK — TRADE not permitted.`,
      disagreementNotes: [
        ...committee.disagreementNotes,
        `Pre-mortem: ${preMortem.topFailureReason}`,
      ],
      topReasons: [preMortem.topFailureReason, ...committee.topReasons].slice(0, 4),
      finalActionPlan:
        "WAIT — pre-mortem blocked hypothetical entry. Resolve failure scenarios first.",
    };
  }

  const learningSnapshot = buildLearningSnapshot(response);

  return {
    ...response,
    preMortem,
    learningSnapshot,
    finalVerdict: committee.finalVerdict,
    committeeVerdict: committee,
    tradingDesk: {
      ...desk,
      committee,
      riskManager: {
        ...desk.riskManager,
        reasons:
          preMortem.preMortemVerdict === "BLOCK"
            ? [
                `Pre-mortem BLOCK: ${preMortem.topFailureReason}`,
                ...desk.riskManager.reasons,
              ].slice(0, 8)
            : desk.riskManager.reasons,
      },
    },
  };
}

export function preMortemBlocksTicket(preMortem?: PreMortemResult | null): boolean {
  return preMortem?.preMortemVerdict === "BLOCK";
}

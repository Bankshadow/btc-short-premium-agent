import { evaluatePromotionEligibility } from "./evaluate-promotion";
import { getStageDefinition, nextStage, SCALE_STAGE_ORDER } from "./stage-definitions";
import type {
  DemoteStageRequest,
  LiveScaleStage,
  PromoteStageRequest,
  ScaleApprovalRecord,
  ScaleStageActionResult,
  ScaleUpInput,
} from "./types";
import { defaultScaleStage } from "./stage-definitions";

function newRecordId(): string {
  return `scale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function promoteStage(
  input: ScaleUpInput,
  request: PromoteStageRequest,
): ScaleStageActionResult {
  const from = input.currentStage;
  const expectedNext = nextStage(from);

  if (!request.operatorApproval) {
    return {
      ok: false,
      fromStage: from,
      toStage: from,
      clientMustPersist: false,
      approvalRecord: null,
      message: "Operator approval required for stage promotion.",
      error: "operatorApproval must be true.",
    };
  }

  if (!expectedNext) {
    return {
      ok: false,
      fromStage: from,
      toStage: from,
      clientMustPersist: false,
      approvalRecord: null,
      message: "Already at maximum stage.",
      error: "No next stage available.",
    };
  }

  if (request.targetStage !== expectedNext) {
    return {
      ok: false,
      fromStage: from,
      toStage: from,
      clientMustPersist: false,
      approvalRecord: null,
      message: "Can only promote one stage at a time.",
      error: `Expected ${expectedNext}, got ${request.targetStage}.`,
    };
  }

  const eligibility = evaluatePromotionEligibility(input);
  if (!eligibility.eligible) {
    return {
      ok: false,
      fromStage: from,
      toStage: from,
      clientMustPersist: false,
      approvalRecord: null,
      message: "Promotion requirements not met.",
      error: eligibility.blockers.join("; "),
    };
  }

  const targetDef = getStageDefinition(request.targetStage);
  if (!targetDef.requiresManualApproval && !request.operatorApproval) {
    return {
      ok: false,
      fromStage: from,
      toStage: from,
      clientMustPersist: false,
      approvalRecord: null,
      message: "Manual approval required.",
      error: "requiresManualApproval",
    };
  }

  const record: ScaleApprovalRecord = {
    id: newRecordId(),
    action: "PROMOTE",
    fromStage: from,
    toStage: request.targetStage,
    operatorNote: request.operatorNote?.trim() ?? "",
    operatorApproval: true,
    reasons: eligibility.requirements.filter((r) => r.met).map((r) => r.label),
    recordedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    fromStage: from,
    toStage: request.targetStage,
    clientMustPersist: true,
    approvalRecord: record,
    message: `Promoted ${from} → ${request.targetStage}.`,
  };
}

export function demoteStage(
  from: LiveScaleStage,
  request: DemoteStageRequest,
): ScaleStageActionResult {
  let to: LiveScaleStage;
  if (request.targetStage) {
    const fromIdx = SCALE_STAGE_ORDER.indexOf(from);
    const toIdx = SCALE_STAGE_ORDER.indexOf(request.targetStage);
    if (toIdx > fromIdx) {
      return {
        ok: false,
        fromStage: from,
        toStage: from,
        clientMustPersist: false,
        approvalRecord: null,
        message: "Demotion cannot increase stage.",
        error: "Invalid demotion target.",
      };
    }
    to = request.targetStage;
  } else {
    const idx = SCALE_STAGE_ORDER.indexOf(from);
    to = idx > 0 ? SCALE_STAGE_ORDER[idx - 1] : defaultScaleStage();
  }

  const record: ScaleApprovalRecord = {
    id: newRecordId(),
    action: request.auto ? "AUTO_DEMOTE" : "DEMOTE",
    fromStage: from,
    toStage: to,
    operatorNote: request.operatorNote?.trim() ?? "",
    operatorApproval: !request.auto,
    reasons: request.reasons ?? [],
    recordedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    fromStage: from,
    toStage: to,
    clientMustPersist: true,
    approvalRecord: record,
    message: request.auto
      ? `Auto-demoted ${from} → ${to}.`
      : `Demoted ${from} → ${to}.`,
  };
}

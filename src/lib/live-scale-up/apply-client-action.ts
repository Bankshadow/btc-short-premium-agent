import type { ScaleStageActionResult } from "./types";
import {
  appendClientApprovalRecord,
  saveClientScaleStage,
} from "./scale-client-store";

export function applyScaleUpClientAction(result: ScaleStageActionResult): void {
  if (!result.ok || !result.clientMustPersist) return;
  saveClientScaleStage(result.toStage);
  if (result.approvalRecord) {
    appendClientApprovalRecord(result.approvalRecord);
  }
}

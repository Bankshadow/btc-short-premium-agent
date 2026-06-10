export type MicroLiveReadinessStatus =
  | "NOT_READY"
  | "READY_PENDING_APPROVAL"
  | "BLOCKED";

export interface ReadinessCriterion {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface MicroLiveReadinessReport {
  status: MicroLiveReadinessStatus;
  evaluatedAt: string;
  criteria: ReadinessCriterion[];
  gaps: string[];
  recommendation: "READY_FOR_CONTROLLED_MICRO_LIVE" | "NOT_READY";
  liveLocked: true;
  operatorApprovalPending: boolean;
}

export const CONTINUOUS_IMPROVEMENT_STORE_FILE = "continuous-improvement-loop.json";
export const CONTINUOUS_IMPROVEMENT_MAX_PROPOSALS = 200;

export const ISSUE_TYPE_LABELS: Record<
  import("./types").ImprovementIssueType,
  string
> = {
  UX_ISSUE: "UX issue",
  DATA_NOT_FLOWING: "Data not flowing",
  TESTNET_FAILURE: "Testnet failure",
  STRATEGY_WEAKNESS: "Strategy weakness",
  REPORT_MISSING: "Report missing",
  RISK_GAP: "Risk gap",
};

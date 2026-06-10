import type {
  ConsistencyIssue,
  ConsistencyStatus,
  EngineConsistencySnapshot,
} from "./types";

const STATUS_RANK: Record<ConsistencyStatus, number> = {
  OK: 0,
  WARNING: 1,
  BLOCKED: 2,
};

export function resolveConsistencyStatus(
  issues: ConsistencyIssue[],
  positionStateUncertain: boolean,
): Pick<
  EngineConsistencySnapshot,
  "consistencyStatus" | "consistencyLabel" | "blocksNewTrades"
> {
  let consistencyStatus: ConsistencyStatus = "OK";

  for (const issue of issues) {
    const severity: ConsistencyStatus =
      issue.severity === "BLOCKED" ? "BLOCKED" : "WARNING";
    if (STATUS_RANK[severity] > STATUS_RANK[consistencyStatus]) {
      consistencyStatus = severity;
    }
  }

  if (positionStateUncertain && STATUS_RANK.BLOCKED > STATUS_RANK[consistencyStatus]) {
    consistencyStatus = "BLOCKED";
  }

  const consistencyLabel =
    consistencyStatus === "OK"
      ? "Consistent"
      : consistencyStatus === "WARNING"
        ? "Warning"
        : "Blocked";

  const blocksNewTrades =
    positionStateUncertain ||
    issues.some(
      (i) =>
        i.severity === "BLOCKED" &&
        (i.kind === "binance_position_not_in_journal" ||
          i.kind === "local_open_no_binance_position"),
    );

  return {
    consistencyStatus,
    consistencyLabel,
    blocksNewTrades,
  };
}

export function evidenceReadinessTone(
  status: string | null | undefined,
): "ok" | "warning" | "blocked" {
  if (
    status === "READY_FOR_TESTNET_CONTINUATION" ||
    status === "READY_FOR_CONTROLLED_TESTNET_AUTO_REVIEW" ||
    status === "COMPLETE"
  ) {
    return "ok";
  }
  if (status === "BLOCKED_BY_SAFETY" || status === "BLOCKED") return "blocked";
  return "warning";
}

export function evidenceStatusLabel(status: string | null | undefined): string {
  if (!status || status === "COLLECTING") return "NOT_READY";
  return status;
}

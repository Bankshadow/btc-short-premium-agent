import type { CoreHealthIssue } from "./core-health";

export interface AggregatedCoreHealthWarning {
  code: string;
  count: number;
  affectedTradeIds: string[];
  severity: "WARNING" | "BLOCK";
  message: string;
  examples: Array<{ message: string; tradeId?: string }>;
}

export interface RawHealthWarning extends CoreHealthIssue {
  tradeId?: string;
}

const MAX_EXAMPLES = 5;

function extractTradeId(message: string): string | undefined {
  const match = message.match(/\btrade-[a-z0-9-]+\b/i);
  return match?.[0];
}

export function aggregateHealthWarnings(
  raw: RawHealthWarning[],
): AggregatedCoreHealthWarning[] {
  const groups = new Map<
    string,
    {
      severity: "WARNING" | "BLOCK";
      tradeIds: Set<string>;
      issueCount: number;
      examples: Array<{ message: string; tradeId?: string }>;
    }
  >();

  for (const issue of raw) {
    const tradeId = issue.tradeId ?? extractTradeId(issue.message);
    const key = `${issue.severity}:${issue.code}`;
    const group = groups.get(key) ?? {
      severity: issue.severity,
      tradeIds: new Set<string>(),
      issueCount: 0,
      examples: [],
    };

    group.issueCount += 1;
    if (tradeId) group.tradeIds.add(tradeId);
    if (group.examples.length < MAX_EXAMPLES) {
      group.examples.push({ message: issue.message, tradeId });
    }
    groups.set(key, group);
  }

  const aggregated: AggregatedCoreHealthWarning[] = [];
  for (const [key, group] of groups) {
    const code = key.split(":").slice(1).join(":");
    const count = group.issueCount;
    const affectedTradeIds = [...group.tradeIds].slice(0, 20);
    aggregated.push({
      code,
      count,
      affectedTradeIds,
      severity: group.severity,
      message: formatAggregatedMessage(code, count, group.severity),
      examples: group.examples,
    });
  }

  return aggregated.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function formatAggregatedMessage(
  code: string,
  count: number,
  severity: "WARNING" | "BLOCK",
): string {
  const noun = count === 1 ? "issue" : "issues";
  const label = humanizeCode(code);
  if (severity === "BLOCK") {
    return `${count} blocking ${label} ${noun} detected.`;
  }
  return `${count} ${label} ${noun} detected.`;
}

function humanizeCode(code: string): string {
  switch (code) {
    case "MISSING_PNL_REALIZED":
    case "PNL_WITHOUT_CLOSE":
      return "closed trades are missing PNL_REALIZED";
    case "CLOSE_WITHOUT_REVIEW":
    case "CLOSE_ORDER_WITHOUT_REVIEW":
      return "close orders executed without CLOSE_REVIEWED";
    case "SKIPPED_LIFECYCLE_STEP":
      return "lifecycle step skips";
    case "STALE_POSITION":
      return "stale position snapshots";
    case "POSITION_CLOSED_WITHOUT_PNL":
      return "POSITION_CLOSED events without PNL_REALIZED";
    default:
      return code.replace(/_/g, " ").toLowerCase();
  }
}

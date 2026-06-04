import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { loadOperatorOverrides } from "@/lib/operator/operator-override";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type {
  KillSwitchStatus,
  StrategyPerformanceRow,
} from "@/lib/validation/validation-types";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type {
  DeskScalePermission,
  ScalePermissionCheck,
  StrategyScalePermission,
} from "./capital-types";

const MAX_OVERRIDES_7D = 3;
const MIN_DATA_QUALITY = 50;

function overridesLast7d(): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return loadOperatorOverrides().filter(
    (o) => new Date(o.createdAt).getTime() >= cutoff,
  ).length;
}

function buildChecks(input: {
  row: StrategyPerformanceRow;
  killSwitch: KillSwitchStatus;
  overrideCount7d: number;
}): ScalePermissionCheck[] {
  const t = VALIDATION_THRESHOLDS;
  const { row, killSwitch, overrideCount7d } = input;

  return [
    {
      id: "sample_size",
      label: "Strategy sample size",
      passed: row.resolvedSignals >= t.minSignalsWatchlist,
      detail: `${row.resolvedSignals} resolved (need ≥ ${t.minSignalsWatchlist} for scale watch, ≥ ${t.minSignalsForActive} for full scale)`,
    },
    {
      id: "avg_r",
      label: "Average R > 0",
      passed: row.averageR > t.avgRDisable,
      detail: `Avg R ${row.averageR} (active threshold ${t.avgRActive})`,
    },
    {
      id: "drawdown",
      label: "Max drawdown within limit",
      passed: row.maxDrawdownPct <= t.maxDrawdownWatchPct,
      detail: `Max DD ${row.maxDrawdownPct}% (watch ${t.maxDrawdownWatchPct}%, disable ${t.maxDrawdownDisablePct}%)`,
    },
    {
      id: "overrides",
      label: "Risk overrides not excessive",
      passed: overrideCount7d <= MAX_OVERRIDES_7D,
      detail: `${overrideCount7d} operator disagrees in 7d (max ${MAX_OVERRIDES_7D})`,
    },
    {
      id: "data_quality",
      label: "Data quality stable",
      passed:
        !killSwitch.activeReasons.includes("data_quality_lockout") &&
        (killSwitch.dataQualityScore == null ||
          killSwitch.dataQualityScore >= MIN_DATA_QUALITY),
      detail:
        killSwitch.dataQualityScore != null
          ? `Desk data quality score ${killSwitch.dataQualityScore}`
          : "No data-quality lockout on kill switch",
    },
  ];
}

function strategyAllowed(
  row: StrategyPerformanceRow,
  checks: ScalePermissionCheck[],
): boolean {
  if (row.status === "DISABLED" || row.status === "PAPER_ONLY") return false;
  const core = checks.filter((c) =>
    ["sample_size", "avg_r", "drawdown"].includes(c.id),
  );
  return core.every((c) => c.passed) && row.status === "ACTIVE";
}

export function buildDeskScalePermission(input: {
  strategyMatrix: StrategyPerformanceRow[];
  killSwitch: KillSwitchStatus;
  entries: DecisionLogEntry[];
}): DeskScalePermission {
  void input.entries;
  const overrideCount7d = overridesLast7d();
  const t = VALIDATION_THRESHOLDS;

  const deskChecks: ScalePermissionCheck[] = [
    {
      id: "desk_sample",
      label: "Desk resolved sample",
      passed:
        input.strategyMatrix.reduce((s, r) => s + r.resolvedSignals, 0) >=
        t.minSignalsWatchlist,
      detail: `Total resolved signals across strategies`,
    },
    {
      id: "desk_kill",
      label: "Kill switch clear",
      passed: !input.killSwitch.tradingPaused,
      detail: input.killSwitch.tradingPaused
        ? `Paused: ${input.killSwitch.activeReasons.join(", ")}`
        : "No trading pause",
    },
    {
      id: "desk_overrides",
      label: "Operator overrides",
      passed: overrideCount7d <= MAX_OVERRIDES_7D,
      detail: `${overrideCount7d} in 7 days`,
    },
    {
      id: "desk_drawdown",
      label: "Portfolio drawdown",
      passed:
        input.killSwitch.peakToTroughDrawdownPct <=
        t.portfolioMaxDrawdownPct,
      detail: `Peak-to-trough ${input.killSwitch.peakToTroughDrawdownPct}% (limit ${t.portfolioMaxDrawdownPct}%)`,
    },
    {
      id: "desk_data",
      label: "Data quality",
      passed:
        !input.killSwitch.activeReasons.includes("data_quality_lockout"),
      detail:
        input.killSwitch.dataQualityScore != null
          ? `Score ${input.killSwitch.dataQualityScore}`
          : "Stable",
    },
  ];

  const strategyPermissions: StrategyScalePermission[] =
    input.strategyMatrix.map((row) => {
      const checks = buildChecks({
        row,
        killSwitch: input.killSwitch,
        overrideCount7d,
      });
      const allowed = strategyAllowed(row, checks);
      const failed = checks.filter((c) => !c.passed);
      return {
        strategyId: row.id,
        label: STRATEGY_LABELS[row.id],
        allowed,
        checks,
        blockedReason: allowed
          ? null
          : failed.map((c) => c.label).join("; ") || row.promotionReason,
      };
    });

  const allowed =
    deskChecks.every((c) => c.passed) &&
    strategyPermissions.some((s) => s.allowed);

  return {
    allowed,
    checks: deskChecks,
    blockedReason: allowed
      ? null
      : deskChecks
          .filter((c) => !c.passed)
          .map((c) => c.label)
          .join("; ") || "No ACTIVE strategy passes scale rules",
    strategyPermissions,
  };
}

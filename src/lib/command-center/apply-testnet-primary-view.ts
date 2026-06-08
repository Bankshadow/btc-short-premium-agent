import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import type {
  CommandCenterBlocker,
  CommandCenterBlockerId,
  CommandCenterReport,
  CommandCenterStatus,
} from "./types";
import type { TestnetPerpDeskPanel } from "./build-testnet-perp-panel";

const LIVE_SCALING_BLOCKER_IDS = new Set<CommandCenterBlockerId>([
  "live_readiness_fail",
  "no_resolved_decision_logs",
  "no_paper_trade_history",
  "strategy_sample_below_threshold",
  "validation_sample_below_threshold",
  "missing_alert_channel",
  "capital_scaling_blocked",
  "supabase_sync_off",
  "alert_channels_off",
  "governance_local_placeholder",
  "audit_not_database_backed",
  "live_readiness_unavailable",
  "warehouse_write_blocked",
  "policy_engine_block",
  "observability_critical",
]);

function resolveStatus(
  blockers: CommandCenterBlocker[],
  cautions: string[],
  emergency: boolean,
): { status: CommandCenterStatus; label: string } {
  if (emergency) {
    return { status: "EMERGENCY", label: "Emergency — halt and review" };
  }
  if (blockers.length > 0) {
    return {
      status: "BLOCKED",
      label: "Hard blockers active — resolve before scaling live",
    };
  }
  if (cautions.length > 0) {
    return { status: "CAUTION", label: "Elevated risk — review cautions" };
  }
  return { status: "SAFE", label: "Ready for live scaling review" };
}

/**
 * When testnet perp is the primary loop, separate operational health from
 * live-readiness / paper-learning blockers in the command center UI.
 */
export function applyTestnetPrimaryCommandCenterView(
  report: CommandCenterReport,
  testnetPerp: TestnetPerpDeskPanel,
): CommandCenterReport {
  if (!isTestnetPrimaryAutomation()) {
    return {
      ...report,
      testnetPerp,
      operationalStatus: report.status,
      operationalStatusLabel: report.statusLabel,
      liveScalingStatus: report.status,
      liveScalingStatusLabel: report.statusLabel,
      liveScalingBlockers: report.blockers,
    };
  }

  let operationalBlockers = report.blockers.filter(
    (b) => !LIVE_SCALING_BLOCKER_IDS.has(b.id),
  );

  if (
    testnetPerp.connected &&
    operationalBlockers.some((b) => b.id === "exchange_disconnected")
  ) {
    operationalBlockers = operationalBlockers.filter(
      (b) => b.id !== "exchange_disconnected",
    );
  }

  if (
    report.blockers.some((b) => b.id === "data_trust_critical") &&
    testnetPerp.connected
  ) {
    operationalBlockers = operationalBlockers.filter(
      (b) => b.id !== "data_trust_critical",
    );
  }

  for (const blocker of testnetPerp.blockers) {
    if (!operationalBlockers.some((b) => b.detail === blocker)) {
      operationalBlockers.push({
        id: "exchange_disconnected",
        label: "Testnet loop",
        detail: blocker,
        hard: true,
      });
    }
  }

  const liveScalingBlockers = report.blockers.filter((b) =>
    LIVE_SCALING_BLOCKER_IDS.has(b.id),
  );

  const emergency =
    report.status === "EMERGENCY" ||
    operationalBlockers.some((b) => b.id === "pilot_emergency_stop");

  const liveScaling = resolveStatus(
    liveScalingBlockers,
    report.cautions,
    emergency,
  );

  return {
    ...report,
    testnetPerp,
    status: testnetPerp.status,
    statusLabel: testnetPerp.statusLabel,
    blockers: operationalBlockers,
    operationalStatus: testnetPerp.status,
    operationalStatusLabel: testnetPerp.statusLabel,
    liveScalingStatus: liveScaling.status,
    liveScalingStatusLabel: liveScaling.label,
    liveScalingBlockers,
  };
}

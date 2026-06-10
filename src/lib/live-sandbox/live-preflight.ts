import { appendEvent } from "@/lib/journal/journal-query";
import { newEventId } from "@/lib/journal/journal-types";
import { evaluateMicroLiveReadiness } from "@/lib/live-readiness/readiness-evaluator";
import {
  allowedPreviewSymbols,
  isLiveEnabled,
  maxPreviewNotionalUsd,
} from "@/lib/risk/risk-gate";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import type { LivePreflightResult } from "./live-sandbox-types";

export async function runLivePreflight(): Promise<LivePreflightResult> {
  const liveEnvPresent = Boolean(process.env.BINANCE_LIVE_ENABLED?.trim());
  const liveEnvDisabledByPolicy = !isLiveEnabled();
  const readiness = await evaluateMicroLiveReadiness();
  const proposals = await getAllImprovementProposals();
  const operatorApproved = !proposals.some((p) => p.status === "PENDING");

  const checks = [
    {
      name: "live_env_present",
      passed: liveEnvPresent,
      detail: liveEnvPresent ? "BINANCE_LIVE_ENABLED set" : "Live env not configured",
    },
    {
      name: "live_env_disabled_by_policy",
      passed: liveEnvDisabledByPolicy,
      detail: "Live execution blocked by v2 policy",
    },
    {
      name: "risk_cap_configured",
      passed: maxPreviewNotionalUsd() > 0,
      detail: `Max notional $${maxPreviewNotionalUsd()}`,
    },
    {
      name: "operator_approval",
      passed: operatorApproved,
      detail: operatorApproved ? "No pending approvals" : "Pending operator approvals",
    },
    {
      name: "audit_enabled",
      passed: true,
      detail: "Event journal audit trail active",
    },
    {
      name: "allowed_symbols",
      passed: allowedPreviewSymbols().length > 0,
      detail: allowedPreviewSymbols().join(", "),
    },
    {
      name: "readiness_status",
      passed: readiness.recommendation === "READY_FOR_CONTROLLED_MICRO_LIVE",
      detail: readiness.recommendation,
    },
  ];

  const blockers = checks.filter((c) => !c.passed).map((c) => c.name);
  if (isLiveEnabled()) blockers.push("LIVE_ENABLED");

  const result: LivePreflightResult = {
    ok: blockers.length === 0,
    checks,
    blockers,
    liveLocked: true,
  };

  await appendEvent({
    type: "LIVE_PREFLIGHT_CHECKED",
    environment: "testnet",
    payload: { ok: result.ok, blockers },
  });

  if (!liveEnvDisabledByPolicy || isLiveEnabled()) {
    await appendEvent({
      type: "LIVE_BLOCKED_BY_POLICY",
      environment: "testnet",
      payload: { reason: "Live trading locked by v2-core policy." },
    });
  }

  return result;
}

export async function runLiveDryRun(): Promise<import("./live-sandbox-types").LiveDryRunResult> {
  const preflight = await runLivePreflight();
  const dryRunId = newEventId("dryrun");

  const blockers = [...preflight.blockers];
  if (!preflight.ok) blockers.push("PREFLIGHT_FAILED");

  const result = {
    ok: blockers.length === 0,
    dryRunId,
    simulatedOrder: null as null,
    blockers,
    message: blockers.length
      ? "Dry-run blocked — no live order sent."
      : "Dry-run passed — live order NOT sent (policy lock).",
    liveLocked: true as const,
  };

  await appendEvent({
    type: "LIVE_DRY_RUN_CREATED",
    environment: "testnet",
    payload: { ...result },
  });

  if (blockers.length > 0) {
    await appendEvent({
      type: "LIVE_BLOCKED_BY_POLICY",
      environment: "testnet",
      payload: { dryRunId, blockers },
    });
  }

  return result;
}

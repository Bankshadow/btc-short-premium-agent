import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newStrategyVersionId } from "@/lib/journal/journal-types";
import type { ImprovementProposal } from "@/lib/improvement/improvement-types";
import { loadStrategyVersions } from "./strategy-version-store";
import type { StrategyVersion } from "./strategy-version-types";

const BASELINE_VERSION: StrategyVersion = {
  versionId: "sv-baseline-v1",
  versionNumber: 1,
  label: "Baseline v2-core",
  changelog: ["Initial testnet-only strategy baseline."],
  createdAt: new Date(0).toISOString(),
  createdBy: "system",
  active: true,
  rollbackOf: null,
};

export async function ensureBaselineStrategyVersion(): Promise<StrategyVersion> {
  const events = await getEvents();
  const existing = loadStrategyVersions(events);
  if (existing.length > 0) return existing.find((v) => v.active) ?? existing[0];

  await appendEvent({
    type: "STRATEGY_VERSION_CREATED",
    environment: "testnet",
    payload: { ...BASELINE_VERSION },
  });

  return BASELINE_VERSION;
}

export async function createStrategyVersionFromImprovement(
  proposal: ImprovementProposal,
  approvedBy: string,
): Promise<StrategyVersion> {
  const events = await getEvents();
  const existing = loadStrategyVersions(events);
  const nextNumber = (existing[0]?.versionNumber ?? 1) + 1;

  const version: StrategyVersion = {
    versionId: newStrategyVersionId(),
    versionNumber: nextNumber,
    label: `Approved: ${proposal.title}`,
    changelog: [
      `Improvement ${proposal.improvementId} approved.`,
      `Type: ${proposal.type}`,
      ...proposal.evidence.slice(0, 5),
    ],
    createdAt: new Date().toISOString(),
    createdBy: approvedBy,
    active: true,
    rollbackOf: null,
  };

  await appendEvent({
    type: "STRATEGY_CHANGE_APPROVED",
    environment: "testnet",
    payload: {
      improvementId: proposal.improvementId,
      versionId: version.versionId,
      type: proposal.type,
    },
  });

  await appendEvent({
    type: "STRATEGY_VERSION_CREATED",
    environment: "testnet",
    payload: { ...version },
  });

  return version;
}

export async function rollbackStrategyVersion(
  versionId: string,
  confirmedBy: string,
): Promise<{ ok: boolean; message: string; version: StrategyVersion | null }> {
  const events = await getEvents();
  const versions = loadStrategyVersions(events);
  const target = versions.find((v) => v.versionId === versionId);
  if (!target) return { ok: false, message: "Version not found.", version: null };

  await appendEvent({
    type: "STRATEGY_ROLLBACK_EXECUTED",
    environment: "testnet",
    payload: {
      versionId,
      confirmedBy,
      rolledBackFrom: versions.find((v) => v.active)?.versionId ?? null,
    },
  });

  const rolledBack: StrategyVersion = {
    ...target,
    active: true,
    rollbackOf: versions.find((v) => v.active)?.versionId ?? null,
    createdAt: new Date().toISOString(),
  };

  await appendEvent({
    type: "STRATEGY_VERSION_CREATED",
    environment: "testnet",
    payload: { ...rolledBack, label: `Rollback to ${target.label}` },
  });

  return { ok: true, message: "Rollback executed.", version: rolledBack };
}

export async function createStrategyVersionManual(input: {
  label: string;
  changelog: string[];
  createdBy: string;
}): Promise<StrategyVersion> {
  const events = await getEvents();
  const existing = loadStrategyVersions(events);
  const nextNumber = (existing[0]?.versionNumber ?? 0) + 1;

  const version: StrategyVersion = {
    versionId: newStrategyVersionId(),
    versionNumber: nextNumber,
    label: input.label,
    changelog: input.changelog,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    active: true,
    rollbackOf: null,
  };

  await appendEvent({
    type: "STRATEGY_VERSION_CREATED",
    environment: "testnet",
    payload: { ...version },
  });

  return version;
}

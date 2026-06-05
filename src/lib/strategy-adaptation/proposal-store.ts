import { patchStrategyOverride } from "@/lib/strategy-registry/strategy-registry-store";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  AdaptationAuditEntry,
  AdaptationApplyResult,
  StrategyAdaptationProposal,
} from "./types";

export const ADAPTATION_PROPOSALS_KEY = "btc-desk:adaptation-proposals";
export const ADAPTATION_AUDIT_KEY = "btc-desk:adaptation-audit-log";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadAdaptationProposals(): StrategyAdaptationProposal[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ADAPTATION_PROPOSALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StrategyAdaptationProposal[]) : [];
  } catch {
    return [];
  }
}

export function saveAdaptationProposals(
  proposals: StrategyAdaptationProposal[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(ADAPTATION_PROPOSALS_KEY, JSON.stringify(proposals));
}

export function mergeAdaptationProposals(
  incoming: StrategyAdaptationProposal[],
): StrategyAdaptationProposal[] {
  const existing = loadAdaptationProposals().filter(
    (p) => p.status === "APPROVED" || p.status === "APPLIED",
  );
  const ids = new Set(existing.map((p) => p.proposalId));
  const merged = [
    ...existing,
    ...incoming.filter((p) => !ids.has(p.proposalId)),
  ];
  saveAdaptationProposals(merged);
  return merged;
}

export function updateAdaptationProposal(
  proposalId: string,
  next: StrategyAdaptationProposal,
): StrategyAdaptationProposal[] {
  const list = loadAdaptationProposals().map((p) =>
    p.proposalId === proposalId ? next : p,
  );
  saveAdaptationProposals(list);
  return list;
}

export function loadAdaptationAuditLog(): AdaptationAuditEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ADAPTATION_AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AdaptationAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendAdaptationAudit(entry: AdaptationAuditEntry): void {
  if (!isBrowser()) return;
  const next = [entry, ...loadAdaptationAuditLog()].slice(0, 200);
  localStorage.setItem(ADAPTATION_AUDIT_KEY, JSON.stringify(next));
}

export function persistApplyResult(result: AdaptationApplyResult): void {
  if (!result.ok || !result.proposal) return;

  updateAdaptationProposal(result.proposal.proposalId, result.proposal);

  if (result.auditEntry) {
    appendAdaptationAudit(result.auditEntry);
  }

  if (result.registryPatch) {
    patchStrategyOverride(
      result.registryPatch.strategyId as StrategyId,
      {
        status: result.registryPatch.status,
        statusLocked: result.registryPatch.statusLocked,
      },
      result.registryPatch.versionNote,
    );
  }
}

export function getPendingProposals(): StrategyAdaptationProposal[] {
  return loadAdaptationProposals().filter(
    (p) => p.status === "PENDING" || p.status === "APPROVED",
  );
}

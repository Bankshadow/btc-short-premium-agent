import { runReflectionAgent } from "@/lib/agents/reflection-agent";
import { buildReplaySnapshot } from "@/lib/replay/build-replay-snapshot";
import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { createDraftRuleFromReflection } from "./draft-rules";
import { computePaperPnl } from "./paper-pnl";
import type {
  DecisionLogEntry,
  OutcomeStatus,
  ResolveOutcomeInput,
} from "./decision-log-types";

export type {
  DecisionLogEntry,
  OutcomeStatus,
  PaperResolution,
  ResolveOutcomeInput,
  StructuredReflection,
} from "./decision-log-types";

export const DECISION_LOG_STORAGE_KEY =
  "trading-agents-crypto-desk:decision-log";

const LEGACY_KEYS = [
  "multi-agent-trading-desk:analysis-journal",
  "btc-short-premium-agent:analysis-journal",
] as const;

/** Store every analyze run (cap to avoid localStorage overflow). */
export const DECISION_LOG_MAX_ENTRIES = 100;

function slimAgent(agent: AgentOutput): AgentOutput {
  return {
    ...agent,
    reasons: agent.reasons.slice(0, 6),
    risks: agent.risks.slice(0, 4),
    vetoReasons: agent.vetoReasons?.slice(0, 8),
  };
}

export function buildDecisionLogEntry(
  data: AnalyzeApiResponse,
): DecisionLogEntry {
  const desk = data.tradingDesk;
  const market = data.step1_marketSnapshot;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: data.step5_verdict.analyzedAt,
    btcPrice: market.spotPrice,
    marketRegime: desk?.marketRegime ?? "Unknown",
    agentOutputs: (desk?.agents ?? []).map(slimAgent),
    finalVerdict: desk?.committee.finalVerdict ?? "WAIT",
    riskVeto: desk?.committee.riskVeto ?? false,
    topReasons:
      desk?.committee.topReasons ?? [data.step5_verdict.summary],
    actionPlan:
      desk?.committee.finalActionPlan ?? data.step6_actionPlan.entryNotes,
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
    replaySnapshot: buildReplaySnapshot(data),
  };
}

function normalizeEntry(raw: Record<string, unknown>): DecisionLogEntry | null {
  if (!raw.timestamp || !raw.id) return null;

  const legacyVerdict =
    (raw.finalVerdict as AgentRecommendation) ??
    (raw.committeeVerdict as AgentRecommendation) ??
    "WAIT";

  let outcomeStatus = (raw.outcomeStatus as OutcomeStatus) ?? "PENDING";
  if (
    outcomeStatus !== "PENDING" &&
    outcomeStatus !== "RESOLVED"
  ) {
    outcomeStatus = raw.resolution ? "RESOLVED" : "PENDING";
  }

  return {
    id: String(raw.id),
    timestamp: String(raw.timestamp),
    btcPrice: Number(raw.btcPrice ?? 0),
    marketRegime: String(raw.marketRegime ?? raw.regime ?? "Unknown"),
    deskRiskProfile:
      raw.deskRiskProfile === "balanced" || raw.deskRiskProfile === "aggressive"
        ? raw.deskRiskProfile
        : undefined,
    agentOutputs: Array.isArray(raw.agentOutputs)
      ? (raw.agentOutputs as AgentOutput[])
      : [],
    finalVerdict: legacyVerdict,
    riskVeto: Boolean(raw.riskVeto ?? raw.riskVetoApplied),
    topReasons: Array.isArray(raw.topReasons)
      ? (raw.topReasons as string[])
      : [],
    actionPlan: String(raw.actionPlan ?? raw.actionSummary ?? ""),
    outcomeStatus,
    paperPnl:
      raw.paperPnl != null ? Number(raw.paperPnl) : null,
    reflection:
      raw.reflection && typeof raw.reflection === "object"
        ? (raw.reflection as DecisionLogEntry["reflection"])
        : null,
    resolution:
      raw.resolution && typeof raw.resolution === "object"
        ? (raw.resolution as DecisionLogEntry["resolution"])
        : undefined,
    replaySnapshot:
      raw.replaySnapshot && typeof raw.replaySnapshot === "object"
        ? (raw.replaySnapshot as DecisionLogEntry["replaySnapshot"])
        : null,
    operatorOverride:
      raw.operatorOverride && typeof raw.operatorOverride === "object"
        ? (raw.operatorOverride as DecisionLogEntry["operatorOverride"])
        : null,
  };
}

function isDecisionLogEntry(value: unknown): value is DecisionLogEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "finalVerdict" in value
  );
}

export function loadDecisionLog(): DecisionLogEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(DECISION_LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            isDecisionLogEntry(item)
              ? item
              : normalizeEntry(item as Record<string, unknown>),
          )
          .filter((e): e is DecisionLogEntry => e != null);
      }
    }

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const parsed = JSON.parse(legacy) as unknown;
      if (!Array.isArray(parsed)) continue;
      const migrated = parsed
        .map((item) =>
          isDecisionLogEntry(item)
            ? normalizeEntry(item as unknown as Record<string, unknown>)
            : normalizeEntry(item as Record<string, unknown>),
        )
        .filter((e): e is DecisionLogEntry => e != null);
      if (migrated.length > 0) {
        persistDecisionLog(migrated);
        return migrated;
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function persistDecisionLog(entries: DecisionLogEntry[]): DecisionLogEntry[] {
  if (typeof window === "undefined") return entries;
  const next = entries.slice(0, DECISION_LOG_MAX_ENTRIES);
  localStorage.setItem(DECISION_LOG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function saveDecisionLogEntry(
  entry: DecisionLogEntry,
): DecisionLogEntry[] {
  return persistDecisionLog([entry, ...loadDecisionLog()]);
}

export function appendDecisionLogFromAnalysis(
  data: AnalyzeApiResponse,
  meta?: { deskRiskProfile?: DecisionLogEntry["deskRiskProfile"] },
): { entries: DecisionLogEntry[]; entry: DecisionLogEntry } {
  const entry = buildDecisionLogEntry(data);
  if (meta?.deskRiskProfile) {
    entry.deskRiskProfile = meta.deskRiskProfile;
  }
  const entries = saveDecisionLogEntry(entry);
  return { entries, entry };
}

export function updateDecisionLogEntry(
  id: string,
  updater: (entry: DecisionLogEntry) => DecisionLogEntry,
): DecisionLogEntry[] {
  const next = loadDecisionLog().map((e) => (e.id === id ? updater(e) : e));
  return persistDecisionLog(next);
}

export interface ResolveOutcomeResult {
  entry: DecisionLogEntry;
  draftRuleCreated: boolean;
}

/** Resolve a pending log entry with paper outcome + reflection (MVP 3). */
export function resolveDecisionOutcome(
  id: string,
  input: ResolveOutcomeInput,
  options: { createDraftRule?: boolean } = { createDraftRule: true },
): ResolveOutcomeResult | null {
  const existing = loadDecisionLog().find((e) => e.id === id);
  if (!existing || existing.outcomeStatus === "RESOLVED") return null;

  const resolution = {
    btcPriceAfter: input.btcPriceAfter,
    tradeWouldWin: input.tradeWouldWin,
    notes: input.notes.trim(),
    resolvedAt: new Date().toISOString(),
  };

  const paperPnl = computePaperPnl(existing, resolution);
  const reflection = runReflectionAgent(
    { ...existing, outcomeStatus: "RESOLVED" },
    resolution,
  );

  const entry: DecisionLogEntry = {
    ...existing,
    outcomeStatus: "RESOLVED",
    resolution,
    paperPnl,
    reflection,
  };

  updateDecisionLogEntry(id, () => entry);

  let draftRuleCreated = false;
  if (options.createDraftRule && reflection.suggestedDraftRule) {
    createDraftRuleFromReflection(id, reflection);
    draftRuleCreated = true;
  }

  return { entry, draftRuleCreated };
}

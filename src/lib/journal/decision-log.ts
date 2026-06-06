import { getActiveWorkspaceId } from "@/lib/platform/workspace-registry";
import { readScopedJson, writeScopedJson } from "@/lib/platform/scoped-storage";
import { runReflectionAgent } from "@/lib/agents/reflection-agent";
import { buildReplaySnapshot } from "@/lib/replay/build-replay-snapshot";
import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { attachTradeControlToEntry } from "@/lib/trade-control/trade-control-log";
import { enrichResolvedEntry } from "@/lib/mortem/resolve-learning";
import { createDraftRuleFromReflection } from "./draft-rules";
import { computePaperPnl } from "./paper-pnl";
import { runPostTradeEvaluation } from "@/lib/self-learning/run-evaluation";
import type { PostTradeEvaluationSource } from "@/lib/self-learning/types";
import type {
  AnalyzePersistStatus,
  DecisionLogEntry,
  OutcomeStatus,
  ResolveOutcomeInput,
  SaveAnalysisResult,
} from "./decision-log-types";

export type {
  AnalyzePersistStatus,
  DecisionLogEntry,
  OutcomeLabel,
  OutcomeStatus,
  PaperResolution,
  ResolveOutcomeInput,
  SaveAnalysisResult,
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

export function deriveAnalyzeRunId(data: AnalyzeApiResponse): string {
  return (
    data.tradingDesk?.analyzedAt ??
    data.step5_verdict.analyzedAt ??
    new Date().toISOString()
  );
}

export function buildDecisionLogEntry(
  data: AnalyzeApiResponse,
  meta?: {
    runId?: string;
    analyzeStatus?: AnalyzePersistStatus;
    isDemoData?: boolean;
    deskRiskProfile?: DecisionLogEntry["deskRiskProfile"];
  },
): DecisionLogEntry {
  const desk = data.tradingDesk;
  const market = data.step1_marketSnapshot;
  const runId = meta?.runId ?? deriveAnalyzeRunId(data);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workspaceId: getActiveWorkspaceId(),
    runId,
    analyzeStatus: meta?.analyzeStatus ?? "SUCCESS",
    isDemoData: meta?.isDemoData ?? false,
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
    preMortem: data.preMortem ?? null,
    learningSnapshot: data.learningSnapshot ?? null,
    autopsy: null,
    regretClassification: null,
    falseTradeFlag: false,
    falseSkipFlag: false,
    missedOpportunityR: 0,
    avoidedLossR: 0,
    lessonTags: [],
    deskRiskProfile: meta?.deskRiskProfile,
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
    runId: raw.runId ? String(raw.runId) : undefined,
    analyzeStatus:
      raw.analyzeStatus === "SUCCESS" ||
      raw.analyzeStatus === "FAILED" ||
      raw.analyzeStatus === "DEMO"
        ? raw.analyzeStatus
        : undefined,
    isDemoData: Boolean(raw.isDemoData),
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
    orderTicket:
      raw.orderTicket && typeof raw.orderTicket === "object"
        ? (raw.orderTicket as DecisionLogEntry["orderTicket"])
        : null,
    tradeControl:
      raw.tradeControl && typeof raw.tradeControl === "object"
        ? (raw.tradeControl as DecisionLogEntry["tradeControl"])
        : null,
    preMortem:
      raw.preMortem && typeof raw.preMortem === "object"
        ? (raw.preMortem as DecisionLogEntry["preMortem"])
        : null,
    autopsy:
      raw.autopsy && typeof raw.autopsy === "object"
        ? (raw.autopsy as DecisionLogEntry["autopsy"])
        : null,
    regretClassification:
      (raw.regretClassification as DecisionLogEntry["regretClassification"]) ??
      null,
    falseTradeFlag: Boolean(raw.falseTradeFlag),
    falseSkipFlag: Boolean(raw.falseSkipFlag),
    missedOpportunityR: Number(raw.missedOpportunityR ?? 0),
    avoidedLossR: Number(raw.avoidedLossR ?? 0),
    lessonTags: Array.isArray(raw.lessonTags)
      ? (raw.lessonTags as string[])
      : [],
    learningSnapshot:
      raw.learningSnapshot && typeof raw.learningSnapshot === "object"
        ? (raw.learningSnapshot as DecisionLogEntry["learningSnapshot"])
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

function normalizeLogArray(parsed: unknown): DecisionLogEntry[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) =>
      isDecisionLogEntry(item)
        ? item
        : normalizeEntry(item as Record<string, unknown>),
    )
    .filter((e): e is DecisionLogEntry => e != null);
}

export function loadDecisionLog(): DecisionLogEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const scoped = readScopedJson<unknown[]>("decision-log", []);
    const normalized = normalizeLogArray(scoped);
    if (normalized.length > 0) return normalized;

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalizeLogArray(JSON.parse(legacy) as unknown);
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
  const ws = getActiveWorkspaceId();
  const next = entries
    .slice(0, DECISION_LOG_MAX_ENTRIES)
    .map((e) => ({ ...e, workspaceId: e.workspaceId ?? ws }));
  writeScopedJson("decision-log", next, ws);
  return next;
}

export function saveDecisionLogEntry(
  entry: DecisionLogEntry,
): DecisionLogEntry[] {
  return persistDecisionLog([entry, ...loadDecisionLog()]);
}

export function appendDecisionLogFromAnalysis(
  data: AnalyzeApiResponse,
  meta?: {
    deskRiskProfile?: DecisionLogEntry["deskRiskProfile"];
    runId?: string;
    analyzeStatus?: AnalyzePersistStatus;
    isDemoData?: boolean;
  },
): SaveAnalysisResult & { entries: DecisionLogEntry[] } {
  const runId = meta?.runId ?? deriveAnalyzeRunId(data);
  const existing = loadDecisionLog().find((e) => e.runId === runId);
  const fresh = buildDecisionLogEntry(data, { ...meta, runId });

  let entry: DecisionLogEntry;
  let status: SaveAnalysisResult["status"] = "created";

  if (existing) {
    status = "updated";
    entry = {
      ...fresh,
      id: existing.id,
      outcomeStatus: existing.outcomeStatus,
      paperPnl: existing.paperPnl,
      reflection: existing.reflection,
      resolution: existing.resolution,
      isDemoData: existing.isDemoData ?? meta?.isDemoData ?? false,
    };
    updateDecisionLogEntry(existing.id, () => entry);
    entry = loadDecisionLog().find((e) => e.id === existing.id) ?? entry;
  } else {
    entry = fresh;
    saveDecisionLogEntry(entry);
    entry = loadDecisionLog().find((e) => e.id === entry.id) ?? entry;
  }

  const attached = attachTradeControlToEntry(entry, data, loadDecisionLog());
  const finalEntry = attached ?? entry;
  return {
    entries: loadDecisionLog(),
    entry: finalEntry,
    status,
  };
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
  options: {
    createDraftRule?: boolean;
    evaluationSource?: PostTradeEvaluationSource;
  } = { createDraftRule: true },
): ResolveOutcomeResult | null {
  const existing = loadDecisionLog().find((e) => e.id === id);
  if (!existing || existing.outcomeStatus === "RESOLVED") return null;

  const resolution = {
    btcPriceAfter: input.btcPriceAfter,
    tradeWouldWin: input.tradeWouldWin,
    outcomeLabel: input.outcomeLabel,
    manualPnlPct: input.manualPnlPct ?? null,
    notes: input.notes.trim(),
    resolvedAt: new Date().toISOString(),
  };

  const paperPnl =
    input.manualPnlPct != null && Number.isFinite(input.manualPnlPct)
      ? Number(input.manualPnlPct.toFixed(2))
      : computePaperPnl(existing, resolution);
  const reflection = runReflectionAgent(
    { ...existing, outcomeStatus: "RESOLVED" },
    resolution,
  );

  let entry: DecisionLogEntry = {
    ...existing,
    outcomeStatus: "RESOLVED",
    resolution,
    paperPnl,
    reflection,
  };

  entry = enrichResolvedEntry(entry, input);

  updateDecisionLogEntry(id, () => entry);

  let draftRuleCreated = false;
  if (options.createDraftRule && reflection.suggestedDraftRule) {
    createDraftRuleFromReflection(id, reflection);
    draftRuleCreated = true;
  }

  runPostTradeEvaluation({
    entry,
    source: options.evaluationSource ?? "manual_resolve",
    pnlOverride: paperPnl,
  });

  return { entry, draftRuleCreated };
}

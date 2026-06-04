import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import { REGIME_LABELS, type MarketRegimeLabel } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";

export const ANALYSIS_JOURNAL_STORAGE_KEY =
  "multi-agent-trading-desk:analysis-journal";

/** Legacy key — migrated on load */
const LEGACY_JOURNAL_KEY = "btc-short-premium-agent:analysis-journal";

export const JOURNAL_MAX_ENTRIES = 10;

export interface AnalysisJournalEntry {
  id: string;
  timestamp: string;
  btcPrice: number;
  regime: string;
  agentOutputs: AgentOutput[];
  committeeVerdict: AgentRecommendation;
  riskVeto: boolean;
  topReasons: string[];
  actionSummary: string;
  /** User-editable later — paper trade outcome */
  paperOutcome: string | null;
}

function slimAgentOutput(agent: AgentOutput): AgentOutput {
  return {
    agentName: agent.agentName,
    marketView: agent.marketView,
    recommendation: agent.recommendation,
    strategyType: agent.strategyType,
    confidence: agent.confidence,
    reasons: agent.reasons.slice(0, 4),
    risks: agent.risks.slice(0, 3),
    proposedAction: agent.proposedAction,
    requiredData: agent.requiredData,
    missingData: agent.missingData,
    veto: agent.veto,
    vetoReasons: agent.vetoReasons?.slice(0, 5),
  };
}

export function buildAnalysisJournalEntry(
  data: AnalyzeApiResponse,
): AnalysisJournalEntry {
  const desk = data.tradingDesk;
  const market = data.step1_marketSnapshot;
  const regimeLabel = desk?.regime.label ?? ("unclear" as MarketRegimeLabel);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: data.step5_verdict.analyzedAt,
    btcPrice: market.spotPrice,
    regime: REGIME_LABELS[regimeLabel] ?? regimeLabel,
    agentOutputs: (desk?.agents ?? []).map(slimAgentOutput),
    committeeVerdict:
      desk?.committeeVerdict.recommendation ?? "WAIT",
    riskVeto: desk?.committeeVerdict.riskVetoApplied ?? false,
    topReasons:
      desk?.committeeVerdict.topReasons ??
      [data.step5_verdict.summary],
    actionSummary:
      desk?.committeeVerdict.actionSummary ??
      data.step6_actionPlan.entryNotes,
    paperOutcome: null,
  };
}

function isJournalEntry(value: unknown): value is AnalysisJournalEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "timestamp" in value &&
    "committeeVerdict" in value
  );
}

function migrateLegacyEntry(raw: Record<string, unknown>): AnalysisJournalEntry | null {
  if (!raw.timestamp) return null;
  return {
    id: String(raw.id ?? `${Date.now()}-legacy`),
    timestamp: String(raw.timestamp),
    btcPrice: Number(raw.btcPrice ?? 0),
    regime: "Legacy import",
    agentOutputs: [],
    committeeVerdict:
      (raw.committeeVerdict as AgentRecommendation) ??
      (raw.verdict === "trade"
        ? "TRADE"
        : raw.verdict === "skip"
          ? "SKIP"
          : "WAIT"),
    riskVeto: Boolean(raw.riskVetoApplied),
    topReasons: Array.isArray(raw.topReasons)
      ? (raw.topReasons as string[])
      : [],
    actionSummary: String(raw.actionSummary ?? ""),
    paperOutcome: null,
  };
}

export function loadAnalysisJournal(): AnalysisJournalEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(ANALYSIS_JOURNAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isJournalEntry);
      }
    }

    const legacy = localStorage.getItem(LEGACY_JOURNAL_KEY);
    if (!legacy) return [];

    const legacyParsed = JSON.parse(legacy) as unknown;
    if (!Array.isArray(legacyParsed)) return [];

    const migrated = legacyParsed
      .map((item) =>
        isJournalEntry(item)
          ? item
          : migrateLegacyEntry(item as Record<string, unknown>),
      )
      .filter((e): e is AnalysisJournalEntry => e != null);

    if (migrated.length > 0) {
      localStorage.setItem(
        ANALYSIS_JOURNAL_STORAGE_KEY,
        JSON.stringify(migrated),
      );
    }
    return migrated;
  } catch {
    return [];
  }
}

export function saveAnalysisJournalEntry(
  entry: AnalysisJournalEntry,
): AnalysisJournalEntry[] {
  if (typeof window === "undefined") return [];

  const next = [entry, ...loadAnalysisJournal()].slice(0, JOURNAL_MAX_ENTRIES);
  localStorage.setItem(ANALYSIS_JOURNAL_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function appendAnalysisFromResponse(
  data: AnalyzeApiResponse,
): AnalysisJournalEntry[] {
  return saveAnalysisJournalEntry(buildAnalysisJournalEntry(data));
}

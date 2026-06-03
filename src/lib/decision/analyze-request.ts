import {
  hasAnyOverride,
  mergeDerivativesOverrides,
  parseDerivativesOverrides,
} from "./derivatives-overrides";
import type {
  AnalysisInput,
  DecisionEngineInput,
  MacroEventStatus,
} from "@/lib/types/market";

type AnalyzeRequestBody = Partial<DecisionEngineInput> &
  AnalysisInput &
  Record<string, unknown>;

function resolveMacroEvent(body: AnalyzeRequestBody): MacroEventStatus | undefined {
  if (body.macroEvent) return body.macroEvent;
  if (body.macroEventToday != null) {
    return { hasEventBeforeSettlement: body.macroEventToday };
  }
  return undefined;
}

/**
 * Normalizes POST /api/analyze body: flat override fields, nested
 * derivativesOverrides, numeric strings, and macroEvent.
 */
export function normalizeAnalyzeRequest(
  body: AnalyzeRequestBody,
): Partial<DecisionEngineInput> & AnalysisInput {
  const derivativesOverrides = mergeDerivativesOverrides(
    parseDerivativesOverrides(body.derivativesOverrides),
    parseDerivativesOverrides(body),
  );

  const macroEvent = resolveMacroEvent(body);

  return {
    ...body,
    macroEvent,
    derivativesOverrides: hasAnyOverride(derivativesOverrides)
      ? derivativesOverrides
      : undefined,
  };
}

import {
  mergeDerivativesOverrides,
  parseDerivativesOverrides,
  type DerivativesOverrideFormValues,
} from "@/lib/decision/derivatives-overrides";
import {
  DEFAULT_MACRO_EVENT,
  macroSelectionToStatus,
  type MacroEventSelection,
} from "@/lib/decision/macro-event";
import type {
  AnalysisInput,
  DecisionEngineInput,
  MacroView,
} from "@/lib/types/market";
import fs from "fs/promises";
import path from "path";

const SETTINGS_FILENAME = "cron-settings.json";
const OVERRIDES_FILENAME = "derivatives-overrides.json";

export function getCronDataDir(): string {
  const base = process.env.JOURNAL_DATA_DIR;
  if (base) return base;
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

async function readJsonFile(filename: string): Promise<unknown | null> {
  try {
    const filePath = path.join(getCronDataDir(), filename);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function loadOverridesFromEnv() {
  return parseDerivativesOverrides({
    liquidation24h: process.env.CRON_LIQUIDATION_24H,
    oi24hChange: process.env.CRON_OI_24H_CHANGE,
    oi1hChange: process.env.CRON_OI_1H_CHANGE,
    volume24hChange: process.env.CRON_VOLUME_24H_CHANGE,
  });
}

function formValuesToParsedOverrides(values: DerivativesOverrideFormValues) {
  return parseDerivativesOverrides(values);
}

function resolveMacroView(settings: Record<string, unknown> | null): MacroView {
  const fromEnv = process.env.CRON_MACRO_VIEW;
  if (fromEnv === "bearish" || fromEnv === "bullish" || fromEnv === "neutral") {
    return fromEnv;
  }
  const raw = settings?.macroView;
  if (raw === "bearish" || raw === "bullish" || raw === "neutral") {
    return raw;
  }
  return "bearish";
}

function resolveMacroEventFromSettings(
  settings: Record<string, unknown> | null,
) {
  const raw = settings?.macroEvent;
  if (raw && typeof raw === "object" && "type" in raw) {
    return macroSelectionToStatus(raw as MacroEventSelection);
  }
  if (
    raw &&
    typeof raw === "object" &&
    "hasEventBeforeSettlement" in raw &&
    typeof (raw as { hasEventBeforeSettlement: unknown })
      .hasEventBeforeSettlement === "boolean"
  ) {
    return raw as AnalysisInput["macroEvent"];
  }
  return macroSelectionToStatus(DEFAULT_MACRO_EVENT);
}

/**
 * Loads cron analysis input from (highest priority last):
 * - defaults
 * - data/derivatives-overrides.json (same shape as dashboard localStorage)
 * - data/cron-settings.json
 * - CRON_* environment variables
 */
export async function loadCronAnalysisInput(): Promise<
  Partial<DecisionEngineInput> & AnalysisInput
> {
  const settings = (await readJsonFile(SETTINGS_FILENAME)) as Record<
    string,
    unknown
  > | null;
  const savedForm = (await readJsonFile(OVERRIDES_FILENAME)) as
    | DerivativesOverrideFormValues
    | null;

  const derivativesOverrides = mergeDerivativesOverrides(
    settings ? parseDerivativesOverrides(settings.derivativesOverrides) : {},
    settings ? parseDerivativesOverrides(settings) : {},
    savedForm ? formValuesToParsedOverrides(savedForm) : {},
    loadOverridesFromEnv(),
  );

  return {
    macroView: resolveMacroView(settings),
    macroEvent: resolveMacroEventFromSettings(settings),
    derivativesOverrides:
      Object.keys(derivativesOverrides).length > 0
        ? derivativesOverrides
        : undefined,
  };
}

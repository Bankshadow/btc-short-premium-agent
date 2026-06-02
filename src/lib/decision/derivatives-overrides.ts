import type { DerivativesOverrides } from "@/lib/types/market";

export const DERIVATIVES_OVERRIDES_STORAGE_KEY =
  "btc-short-premium-agent:derivatives-overrides";

export interface DerivativesOverrideFormValues {
  liquidation24h: string;
  oi24hChange: string;
  oi1hChange: string;
  volume24hChange: string;
}

export const EMPTY_OVERRIDE_FORM: DerivativesOverrideFormValues = {
  liquidation24h: "",
  oi24hChange: "",
  oi1hChange: "",
  volume24hChange: "",
};

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formValuesToOverrides(
  values: DerivativesOverrideFormValues,
): DerivativesOverrides {
  const liquidation24h = parseOptionalNumber(values.liquidation24h);
  const oi24hChange = parseOptionalNumber(values.oi24hChange);
  const oi1hChange = parseOptionalNumber(values.oi1hChange);
  const volume24hChange = parseOptionalNumber(values.volume24hChange);

  const overrides: DerivativesOverrides = {};
  if (liquidation24h !== null) overrides.liquidation24h = liquidation24h;
  if (oi24hChange !== null) overrides.oi24hChange = oi24hChange;
  if (oi1hChange !== null) overrides.oi1hChange = oi1hChange;
  if (volume24hChange !== null) overrides.volume24hChange = volume24hChange;

  return overrides;
}

export function overridesToFormValues(
  overrides: DerivativesOverrides,
): DerivativesOverrideFormValues {
  return {
    liquidation24h:
      overrides.liquidation24h != null ? String(overrides.liquidation24h) : "",
    oi24hChange:
      overrides.oi24hChange != null ? String(overrides.oi24hChange) : "",
    oi1hChange: overrides.oi1hChange != null ? String(overrides.oi1hChange) : "",
    volume24hChange:
      overrides.volume24hChange != null ? String(overrides.volume24hChange) : "",
  };
}

export function loadOverridesFromStorage(): DerivativesOverrideFormValues {
  if (typeof window === "undefined") return EMPTY_OVERRIDE_FORM;

  try {
    const raw = localStorage.getItem(DERIVATIVES_OVERRIDES_STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDE_FORM;
    const parsed = JSON.parse(raw) as DerivativesOverrideFormValues;
    return { ...EMPTY_OVERRIDE_FORM, ...parsed };
  } catch {
    return EMPTY_OVERRIDE_FORM;
  }
}

export function saveOverridesToStorage(values: DerivativesOverrideFormValues) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DERIVATIVES_OVERRIDES_STORAGE_KEY,
    JSON.stringify(values),
  );
}

export function hasAnyOverride(overrides: DerivativesOverrides): boolean {
  return (
    overrides.liquidation24h != null ||
    overrides.oi24hChange != null ||
    overrides.oi1hChange != null ||
    overrides.volume24hChange != null
  );
}

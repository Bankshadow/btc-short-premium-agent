import {
  DEFAULT_TRADE_CONTROL_SETTINGS,
  TRADE_CONTROL_SETTINGS_KEY,
  type TradeControlSettings,
} from "./trade-control-types";

export function loadTradeControlSettings(): TradeControlSettings {
  if (typeof window === "undefined") return DEFAULT_TRADE_CONTROL_SETTINGS;
  try {
    const raw = localStorage.getItem(TRADE_CONTROL_SETTINGS_KEY);
    if (!raw) return DEFAULT_TRADE_CONTROL_SETTINGS;
    return { ...DEFAULT_TRADE_CONTROL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TRADE_CONTROL_SETTINGS;
  }
}

export function saveTradeControlSettings(
  patch: Partial<TradeControlSettings>,
): TradeControlSettings {
  const next = { ...loadTradeControlSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADE_CONTROL_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}

export function isHumanApprovalRequired(): boolean {
  return loadTradeControlSettings().humanApprovalRequired;
}

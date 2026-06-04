import type { ModeEffects } from "./trading-os-types";
import { resolveModeEffects } from "./environment-modes";

let activeEffects: ModeEffects = resolveModeEffects("SEMI_LIVE");

export function applyTradingOsRuntime(effects: ModeEffects): void {
  activeEffects = effects;
}

export function getTradingOsModeEffects(): ModeEffects {
  return activeEffects;
}

export function allowOrderTicketsInCurrentMode(): boolean {
  return activeEffects.allowOrderTickets;
}

export function allowMockFallbackInCurrentMode(): boolean {
  return activeEffects.allowMockFallback;
}

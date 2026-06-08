import { resolveLastAutomationRunAt } from "@/lib/automation-control-plane/cron-config";
import { loadAutomationState } from "@/lib/automation-control-plane/state-store";
import {
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "@/lib/exchange/binance/binance-config";
import { getBinanceStatus, getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import type { CommandCenterStatus } from "./types";

export interface TestnetPerpDeskPanel {
  enabled: boolean;
  connected: boolean;
  autoExecuteEnabled: boolean;
  openPositionCount: number;
  allowedSymbols: string[];
  symbolsHeld: string[];
  maxOpenPositions: number;
  lastAutomationRunAt: string | null;
  automationEnabled: boolean;
  automationPaused: boolean;
  status: CommandCenterStatus;
  statusLabel: string;
  blockers: string[];
}

function resolveTestnetStatus(blockers: string[]): {
  status: CommandCenterStatus;
  label: string;
} {
  if (blockers.some((b) => /emergency|kill switch/i.test(b))) {
    return { status: "EMERGENCY", label: "Testnet halted — risk stop active" };
  }
  if (blockers.length > 0) {
    return { status: "BLOCKED", label: "Testnet loop blocked — check connectivity" };
  }
  return { status: "SAFE", label: "Testnet perp loop operational" };
}

export async function buildTestnetPerpDeskPanel(): Promise<TestnetPerpDeskPanel> {
  const config = loadBinanceConfig();
  const enabled = isBinanceTestnetAutoExecuteEnabled() && config.testnetEnabled;
  const blockers: string[] = [];

  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      autoExecuteEnabled: false,
      openPositionCount: 0,
      allowedSymbols: config.allowedSymbols,
      symbolsHeld: [],
      maxOpenPositions: config.maxOpenPositions,
      lastAutomationRunAt: null,
      automationEnabled: false,
      automationPaused: false,
      status: "CAUTION",
      statusLabel: "Binance testnet autoexec disabled",
      blockers: ["BINANCE_TESTNET_AUTOEXECUTE_ENABLED is off."],
    };
  }

  const [status, positions, automationState] = await Promise.all([
    getBinanceStatus().catch(() => null),
    getPositions().catch(() => []),
    loadAutomationState().catch(() => null),
  ]);

  const open = positions.filter((p) => Math.abs(Number(p.positionAmt)) > 0);
  if (!status?.connected) {
    blockers.push(status?.error ?? "Binance testnet not connected.");
  }
  if (automationState && !automationState.settings.automationEnabled) {
    blockers.push("Automation disabled.");
  }
  if (automationState?.settings.paused) {
    blockers.push("Automation paused.");
  }

  const { status: deskStatus, label } = resolveTestnetStatus(blockers);

  return {
    enabled: true,
    connected: status?.connected ?? false,
    autoExecuteEnabled: status?.autoExecuteEnabled ?? false,
    openPositionCount: open.length,
    allowedSymbols: config.allowedSymbols,
    symbolsHeld: open.map((p) => p.symbol),
    maxOpenPositions: config.maxOpenPositions,
    lastAutomationRunAt: automationState
      ? resolveLastAutomationRunAt(automationState)
      : null,
    automationEnabled: automationState?.settings.automationEnabled ?? false,
    automationPaused: automationState?.settings.paused ?? false,
    status: deskStatus,
    statusLabel: label,
    blockers,
  };
}

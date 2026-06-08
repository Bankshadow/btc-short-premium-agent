import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";

const STATE_FILE = "symbol-rotation-state.json";
const ROTATE_OUT_AFTER_SKIPS = 3;

interface SymbolRotationState {
  skipStreaks: Record<string, number>;
  lastUpdated: string;
}

function defaultState(): SymbolRotationState {
  return { skipStreaks: {}, lastUpdated: new Date().toISOString() };
}

async function loadState(): Promise<SymbolRotationState> {
  const parsed = await readCronJsonFile(STATE_FILE, defaultState());
  return {
    skipStreaks: parsed.skipStreaks ?? {},
    lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
  };
}

async function saveState(state: SymbolRotationState): Promise<void> {
  await writeCronJsonFile(STATE_FILE, state);
}

export async function shouldRotateOutSymbol(symbol: string): Promise<boolean> {
  const state = await loadState();
  const streak = state.skipStreaks[symbol.toUpperCase()] ?? 0;
  return streak >= ROTATE_OUT_AFTER_SKIPS;
}

export async function recordAutopilotCycleOutcome(input: {
  tradedSymbols: string[];
  candidateSymbols: string[];
}): Promise<void> {
  const state = await loadState();
  const traded = new Set(input.tradedSymbols.map((s) => s.toUpperCase()));
  const candidates = input.candidateSymbols.map((s) => s.toUpperCase());

  for (const symbol of candidates) {
    if (traded.has(symbol)) {
      delete state.skipStreaks[symbol];
    } else {
      state.skipStreaks[symbol] = (state.skipStreaks[symbol] ?? 0) + 1;
    }
  }

  for (const symbol of traded) {
    state.skipStreaks[symbol] = 0;
  }

  state.lastUpdated = new Date().toISOString();
  await saveState(state);
}

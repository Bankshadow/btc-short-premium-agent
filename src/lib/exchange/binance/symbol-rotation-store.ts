import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";

const STATE_FILE = "symbol-rotation-state.json";
const ROTATE_OUT_AFTER_SKIPS = 3;

interface SymbolRotationState {
  skipStreaks: Record<string, number>;
  lastUpdated: string;
}

function statePath(): string {
  return path.join(getCronDataDir(), STATE_FILE);
}

async function loadState(): Promise<SymbolRotationState> {
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SymbolRotationState>;
    return {
      skipStreaks: parsed.skipStreaks ?? {},
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
    };
  } catch {
    return { skipStreaks: {}, lastUpdated: new Date().toISOString() };
  }
}

async function saveState(state: SymbolRotationState): Promise<void> {
  const filePath = statePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
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

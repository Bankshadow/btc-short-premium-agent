import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newEventId } from "@/lib/journal/journal-types";
import {
  allowedPreviewSymbols,
  maxPreviewNotionalUsd,
} from "@/lib/risk/risk-gate";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import {
  getKillSwitchState,
  refreshKillSwitchFromJournal,
  setKillSwitchCache,
} from "./kill-switch";
import type {
  EngineRunState,
  ManualNote,
  OperatorActionResult,
  OperatorStatus,
  RiskMode,
} from "./operator-types";

let engineState: EngineRunState = "RUNNING";
let riskMode: RiskMode = "NORMAL";

async function recordOperatorAction(action: string, payload: Record<string, unknown>): Promise<void> {
  await appendEvent({
    type: "OPERATOR_ACTION_RECORDED",
    environment: "testnet",
    payload: { action, ...payload, recordedAt: new Date().toISOString() },
  });
}

function loadEngineStateFromJournal(events: Awaited<ReturnType<typeof getEvents>>): EngineRunState {
  let state: EngineRunState = "RUNNING";
  for (const evt of [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (evt.type === "ENGINE_PAUSED") state = "PAUSED";
    if (evt.type === "ENGINE_RESUMED") state = "RUNNING";
  }
  return state;
}

function loadRiskModeFromJournal(events: Awaited<ReturnType<typeof getEvents>>): RiskMode {
  let mode: RiskMode = "NORMAL";
  for (const evt of [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (evt.type === "RISK_MODE_CHANGED") {
      mode = String((evt.payload as { mode?: RiskMode }).mode ?? "NORMAL") as RiskMode;
    }
  }
  return mode;
}

function loadManualNotes(events: Awaited<ReturnType<typeof getEvents>>): ManualNote[] {
  return events
    .filter((e) => e.type === "MANUAL_NOTE_CREATED")
    .map((e) => ({
      noteId: String((e.payload as { noteId?: string }).noteId ?? e.eventId),
      text: String((e.payload as { text?: string }).text ?? ""),
      createdAt: e.timestamp,
      createdBy: String((e.payload as { createdBy?: string }).createdBy ?? "operator"),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);
}

export async function hydrateOperatorGateState(): Promise<void> {
  await refreshKillSwitchFromJournal();
  const events = await getEvents();
  engineState = loadEngineStateFromJournal(events);
  riskMode = loadRiskModeFromJournal(events);
}

export async function getOperatorStatus(): Promise<OperatorStatus> {
  await hydrateOperatorGateState();
  const events = await getEvents();
  const kill = getKillSwitchState();
  const proposals = await getAllImprovementProposals();

  return {
    killSwitchActive: kill.active,
    killSwitchReason: kill.reason,
    riskMode,
    engineState,
    pendingApprovals: proposals
      .filter((p) => p.status === "PENDING")
      .map((p) => ({ improvementId: p.improvementId, title: p.title, type: p.type })),
    allowedSymbols: allowedPreviewSymbols(),
    maxNotionalUsd: maxPreviewNotionalUsd(),
    latestManualNotes: loadManualNotes(events),
    liveLocked: true,
    checkedAt: new Date().toISOString(),
  };
}

export function getEngineRunState(): EngineRunState {
  return engineState;
}

export function isEnginePaused(): boolean {
  return engineState === "PAUSED";
}

export async function getLatestManualNoteText(): Promise<string | null> {
  const events = await getEvents();
  const notes = loadManualNotes(events);
  return notes[0]?.text ?? null;
}

export async function enableKillSwitch(input: {
  reason: string;
  doubleConfirm: boolean;
  operatorId?: string;
}): Promise<OperatorActionResult> {
  if (!input.doubleConfirm) {
    return { ok: false, message: "Double confirm required to enable kill switch." };
  }

  setKillSwitchCache({ active: true, reason: input.reason });
  await appendEvent({
    type: "KILL_SWITCH_ENABLED",
    environment: "testnet",
    payload: { reason: input.reason, operatorId: input.operatorId ?? "operator" },
  });
  await recordOperatorAction("KILL_SWITCH_ENABLE", { reason: input.reason });

  return { ok: true, message: "Kill switch enabled — analysis, preview, execution, and close blocked." };
}

export async function disableKillSwitch(input: {
  doubleConfirm: boolean;
  operatorId?: string;
}): Promise<OperatorActionResult> {
  if (!input.doubleConfirm) {
    return { ok: false, message: "Double confirm required to disable kill switch." };
  }

  setKillSwitchCache({ active: false, reason: null });
  await appendEvent({
    type: "KILL_SWITCH_DISABLED",
    environment: "testnet",
    payload: { operatorId: input.operatorId ?? "operator" },
  });
  await recordOperatorAction("KILL_SWITCH_DISABLE", {});

  return { ok: true, message: "Kill switch disabled." };
}

export async function setRiskMode(input: {
  mode: RiskMode;
  doubleConfirm: boolean;
  operatorId?: string;
}): Promise<OperatorActionResult> {
  if (!input.doubleConfirm) {
    return { ok: false, message: "Double confirm required to change risk mode." };
  }

  riskMode = input.mode;
  await appendEvent({
    type: "RISK_MODE_CHANGED",
    environment: "testnet",
    payload: { mode: input.mode, operatorId: input.operatorId ?? "operator" },
  });
  await recordOperatorAction("RISK_MODE_CHANGE", { mode: input.mode });

  return { ok: true, message: `Risk mode set to ${input.mode}.`, status: { riskMode: input.mode } };
}

export async function createManualNote(input: {
  text: string;
  operatorId?: string;
}): Promise<OperatorActionResult> {
  if (!input.text.trim()) {
    return { ok: false, message: "Note text required." };
  }

  const noteId = newEventId("note");
  await appendEvent({
    type: "MANUAL_NOTE_CREATED",
    environment: "testnet",
    payload: {
      noteId,
      text: input.text.trim(),
      createdBy: input.operatorId ?? "operator",
    },
  });
  await recordOperatorAction("MANUAL_NOTE", { noteId, text: input.text.trim() });

  return { ok: true, message: "Manual note recorded." };
}

export async function pauseEngine(input: {
  reason: string;
  doubleConfirm: boolean;
}): Promise<OperatorActionResult> {
  if (!input.doubleConfirm) {
    return { ok: false, message: "Double confirm required to pause engine." };
  }

  engineState = "PAUSED";
  await appendEvent({
    type: "ENGINE_PAUSED",
    environment: "testnet",
    payload: { reason: input.reason },
  });
  await recordOperatorAction("ENGINE_PAUSE", { reason: input.reason });

  return { ok: true, message: "Engine paused.", status: { engineState: "PAUSED" } };
}

export async function resumeEngine(input: {
  doubleConfirm: boolean;
}): Promise<OperatorActionResult> {
  if (!input.doubleConfirm) {
    return { ok: false, message: "Double confirm required to resume engine." };
  }

  engineState = "RUNNING";
  await appendEvent({
    type: "ENGINE_RESUMED",
    environment: "testnet",
    payload: {},
  });
  await recordOperatorAction("ENGINE_RESUME", {});

  return { ok: true, message: "Engine resumed.", status: { engineState: "RUNNING" } };
}

export function isOperatorBlockedSync(): { blocked: boolean; reason: string | null } {
  const kill = getKillSwitchState();
  if (kill.active) {
    return { blocked: true, reason: kill.reason ?? "Kill switch active." };
  }
  if (engineState === "PAUSED") {
    return { blocked: true, reason: "Engine paused by operator." };
  }
  return { blocked: false, reason: null };
}

export async function isOperatorBlocked(): Promise<{ blocked: boolean; reason: string | null }> {
  await hydrateOperatorGateState();
  return isOperatorBlockedSync();
}

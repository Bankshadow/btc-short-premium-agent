export { evaluateCoreHealth, isCoreHealthBlockingExecution } from "./core-health";
export type { CoreHealthIssue, CoreHealthReport } from "./core-health";
export { appendCoreEvent, appendCoreEventStrict, readCoreEvents } from "./event-store";
export { replayJournalProjections } from "./event-replay";
export type { ReplayReport } from "./event-replay";
export { buildAllProjections, buildProjectionById, clearProjectionCache } from "./projection-engine";
export type { CoreProjections, ProjectionId } from "./projection-engine";
export { validateEventEnvelope, validateEventBatch, validateBeforeAppend, validateCoreEvent, validateRawCoreEvent } from "./event-validator";
export { deriveTradeLifecycleState, deriveLifecycleState, validateAllTradeLifecycles, validateLifecycleTransition } from "./lifecycle-state-machine";
export { runExecuteGuardChain, runCloseGuardChain } from "./guard-chain";
export { buildTraceReport, detectTraceLinkKind } from "./trace/trace-builder";
export type { TraceReport, TraceLinkKind } from "./trace/trace-types";
export { LOOP_CONTRACTS, getLoopContract } from "./loop-contracts";
export type { LoopContractId } from "./loop-contracts";

import { evaluateCoreHealth } from "./core-health";
import { readCoreEvents } from "./event-store";
import { replayJournalProjections } from "./event-replay";
import { buildAllProjections } from "./projection-engine";
import { buildTraceReport, detectTraceLinkKind } from "./trace/trace-builder";
import type { TraceLinkKind } from "./trace/trace-types";

export async function getCoreEngineSnapshot() {
  const events = await readCoreEvents();
  return {
    health: await evaluateCoreHealth(),
    projections: buildAllProjections(events),
    eventCount: events.length,
  };
}

export async function buildCoreTrace(id: string, kind?: TraceLinkKind) {
  const events = await readCoreEvents();
  const resolvedKind = kind ?? detectTraceLinkKind(id, events);
  if (!resolvedKind) {
    return null;
  }
  return buildTraceReport(events, resolvedKind, id);
}

export async function runCoreReplay() {
  return replayJournalProjections();
}

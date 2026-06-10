import { readCoreEvents } from "./event-store";
import { buildAllProjections, clearProjectionCache } from "./projection-engine";
import { validateEventBatch } from "./event-validator";
import type { CoreValidationIssue } from "./core-errors";

export interface ReplayReport {
  ok: boolean;
  eventCount: number;
  projectionBuiltAt: string;
  issues: CoreValidationIssue[];
  projections: ReturnType<typeof buildAllProjections>;
}

export async function replayJournalProjections(): Promise<ReplayReport> {
  clearProjectionCache();
  const events = await readCoreEvents();
  const issues = validateEventBatch(events, { checkLifecycle: true });
  const projections = buildAllProjections(events, { bustCache: true });
  const errors = issues.filter((i) => i.severity === "ERROR");
  return {
    ok: errors.length === 0,
    eventCount: events.length,
    projectionBuiltAt: projections.meta.builtAt,
    issues,
    projections,
  };
}

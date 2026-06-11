import { StatusBadge, type StatusTone } from "./status-badge";
import { SectionCard } from "./section-card";

export const LIFECYCLE_PHASES = [
  "Analysis",
  "Preview",
  "Safety Review",
  "Execute",
  "Position Open",
  "Monitor",
  "Close",
  "PnL",
  "Learning",
  "Evidence",
] as const;

export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

export interface LifecycleTimelineProps {
  activePhase?: LifecyclePhase | null;
  completedPhases?: LifecyclePhase[];
  fields?: Array<{ label: string; value: string }>;
  zeroState?: boolean;
}

function phaseTone(
  phase: LifecyclePhase,
  active?: LifecyclePhase | null,
  completed?: LifecyclePhase[],
): StatusTone {
  if (active === phase) return "warning";
  if (completed?.includes(phase)) return "ok";
  return "neutral";
}

export function LifecycleTimeline({
  activePhase,
  completedPhases = [],
  fields = [],
  zeroState,
}: LifecycleTimelineProps) {
  return (
    <SectionCard title="Current Lifecycle" zeroState={zeroState}>
      <div className="flex flex-wrap gap-2">
        {LIFECYCLE_PHASES.map((phase) => (
          <StatusBadge
            key={phase}
            label={phase}
            tone={phaseTone(phase, activePhase, completedPhases)}
          />
        ))}
      </div>
      {fields.length > 0 ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded border border-[var(--border)] p-2">
              <dt className="text-xs text-[var(--muted)]">{f.label}</dt>
              <dd className="mt-0.5 font-mono text-sm break-all">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </SectionCard>
  );
}

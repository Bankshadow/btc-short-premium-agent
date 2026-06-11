import { SectionCard } from "./section-card";

export interface EventFeedItem {
  id: string;
  type: string;
  timestamp: string;
  meta?: string;
}

export function EventFeed({
  title = "Event feed",
  events,
  emptyMessage = "No events yet.",
  limit = 12,
  zeroState,
}: {
  title?: string;
  events: EventFeedItem[];
  emptyMessage?: string;
  limit?: number;
  zeroState?: boolean;
}) {
  const slice = events.slice(0, limit);

  return (
    <SectionCard title={title} zeroState={zeroState}>
      {slice.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {slice.map((e) => (
            <div key={e.id} className="ui-event-row">
              <span className="font-mono text-[var(--accent)]">{e.type}</span>
              <span className="text-xs text-[var(--muted)]">
                {new Date(e.timestamp).toLocaleString()}
              </span>
              {e.meta ? <p className="text-xs text-[var(--muted)]">{e.meta}</p> : null}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

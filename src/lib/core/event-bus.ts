import type { JournalEvent } from "@/lib/journal/journal-types";

export type CoreEventHandler = (event: JournalEvent) => void | Promise<void>;

const subscribers = new Map<string, CoreEventHandler[]>();

export function subscribeCoreEvent(topic: string, handler: CoreEventHandler): () => void {
  const list = subscribers.get(topic) ?? [];
  list.push(handler);
  subscribers.set(topic, list);
  return () => {
    const current = subscribers.get(topic) ?? [];
    subscribers.set(
      topic,
      current.filter((h) => h !== handler),
    );
  };
}

export async function publishCoreEvent(event: JournalEvent): Promise<void> {
  const global = subscribers.get("*") ?? [];
  const typed = subscribers.get(event.type) ?? [];
  for (const handler of [...global, ...typed]) {
    await handler(event);
  }
}

export function clearCoreEventSubscribers(): void {
  subscribers.clear();
}

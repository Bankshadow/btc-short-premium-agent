"use client";

import type { AiStatusEvent } from "@/lib/ai-status/types";

export default function AIStatusTechnicalLog({ events }: { events: AiStatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-zinc-500">No technical events logged.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 font-mono text-[10px] text-zinc-500">
      {events.map((e) => (
        <div key={e.id} className="border-b border-zinc-900/80 py-1 last:border-0">
          <span className="text-zinc-600">{new Date(e.timestamp).toISOString()}</span>{" "}
          <span className="text-indigo-400">{e.type}</span>{" "}
          <span className="text-zinc-400">{e.label}</span>
          {e.detail && <span className="text-zinc-600"> — {e.detail}</span>}
          {e.technical && (
            <pre className="mt-0.5 whitespace-pre-wrap text-zinc-700">{e.technical}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { ADVANCED_DRAWERS_HINT } from "@/lib/ux/operator-copy";

type Drawer = {
  id: string;
  title: string;
  summary?: string;
  children: ReactNode;
};

function DrawerPanel({ drawer }: { drawer: Drawer }) {
  return (
    <details className="group rounded-xl border border-zinc-800/80 bg-zinc-950/40">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-zinc-300 [&::-webkit-details-marker]:hidden">
        {drawer.title}
        {drawer.summary && (
          <span className="ml-2 font-normal text-zinc-600">— {drawer.summary}</span>
        )}
        <span className="ml-2 opacity-50 group-open:hidden">▸</span>
        <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
      </summary>
      <div className="border-t border-zinc-800 px-4 pb-4 pt-3">{drawer.children}</div>
    </details>
  );
}

export default function CockpitAdvancedDrawers({ drawers }: { drawers: Drawer[] }) {
  if (drawers.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Advanced details
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-600">{ADVANCED_DRAWERS_HINT}</p>
      </div>
      {drawers.map((d) => (
        <DrawerPanel key={d.id} drawer={d} />
      ))}
    </section>
  );
}

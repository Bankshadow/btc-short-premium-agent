"use client";

import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  environmentBadgeClass,
  TRADING_ENVIRONMENT_LABELS,
} from "@/lib/platform/environment";
import type { TradingEnvironment, Workspace } from "@/lib/platform/types";

export default function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    workspace,
    workspaces,
    settings,
    switchWorkspace,
    role,
  } = useWorkspace();

  const env = settings.tradingEnvironment as TradingEnvironment;

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "min-w-0"}`}>
      <label className="sr-only" htmlFor="workspace-switcher">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        value={workspace.id}
        onChange={(e) => switchWorkspace(e.target.value)}
        className="max-w-[160px] truncate rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
        title={workspace.name}
      >
        {workspaces.map((w: Workspace) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <span
        className={`hidden rounded px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 sm:inline ${environmentBadgeClass(env)}`}
      >
        {TRADING_ENVIRONMENT_LABELS[env]}
      </span>
      {!compact && (
        <span className="hidden text-[10px] text-zinc-500 lg:inline">{role}</span>
      )}
      <Link
        href="/settings/workspace"
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        Settings
      </Link>
    </div>
  );
}

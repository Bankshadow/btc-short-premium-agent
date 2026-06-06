"use client";

import { useState } from "react";
import type { PermissionMatrixResult } from "@/lib/agent-os/types";
import { AGENT_OS_ACTION_LABELS } from "@/lib/agent-os/mode-rules";
import type { PermissionAuditEvent } from "@/lib/agent-os/types";
import {
  loadAgentOsSettings,
  saveAgentOsSettings,
} from "@/lib/agent-os/settings-store";

type Props = {
  matrix: PermissionMatrixResult[];
  audit?: PermissionAuditEvent[];
};

export default function AgentOsMatrixPanel({ matrix, audit = [] }: Props) {
  const [settings, setSettings] = useState(loadAgentOsSettings);

  const patch = (next: Partial<typeof settings>) => {
    const saved = saveAgentOsSettings(next);
    setSettings(saved);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500">
        Full permission matrix — advanced operator view. Live execution always blocked.
      </p>

      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
        <p className="mb-2 font-semibold text-zinc-300">Mode overrides</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.observeOnly}
            onChange={(e) => patch({ observeOnly: e.target.checked })}
          />
          Observe only (read-only dashboard)
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.testnetAllowAllExplicitlyEnabled}
            onChange={(e) =>
              patch({
                testnetAllowAllSafe: e.target.checked,
                testnetAllowAllExplicitlyEnabled: e.target.checked,
              })
            }
          />
          Enable TESTNET_ALLOW_ALL_SAFE (auto-execute within daily limits)
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-zinc-600">
            <tr>
              <th className="pb-2 pr-3">Action</th>
              <th className="pb-2 pr-3">Allowed</th>
              <th className="pb-2 pr-3">Ask?</th>
              <th className="pb-2 pr-3">Blocked</th>
              <th className="pb-2 pr-3">Min mode</th>
              <th className="pb-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.action} className="border-t border-zinc-800/60 text-zinc-400">
                <td className="py-2 pr-3 font-medium text-zinc-300">
                  {AGENT_OS_ACTION_LABELS[row.action]}
                </td>
                <td className={`py-2 pr-3 ${row.allowed ? "text-emerald-400" : "text-zinc-600"}`}>
                  {row.allowed ? "Yes" : "No"}
                </td>
                <td className={`py-2 pr-3 ${row.requiresPermission ? "text-amber-400" : "text-zinc-600"}`}>
                  {row.requiresPermission ? "Yes" : "No"}
                </td>
                <td className={`py-2 pr-3 ${row.blocked ? "text-rose-400" : "text-zinc-600"}`}>
                  {row.blocked ? "Yes" : "No"}
                </td>
                <td className="py-2 pr-3 text-zinc-500">{row.requiredMode}</td>
                <td className="py-2 text-zinc-500">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {audit.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            Recent permission decisions
          </h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px] text-zinc-500">
            {audit.map((e) => (
              <li key={e.id} className="rounded border border-zinc-800/60 px-2 py-1">
                <span className={e.approved ? "text-emerald-400" : "text-rose-400"}>
                  {e.approved ? "Approved" : "Denied"}
                </span>{" "}
                · {AGENT_OS_ACTION_LABELS[e.action]} · {e.actor} ·{" "}
                {new Date(e.timestamp).toLocaleString()}
                {e.linkedDecisionId && ` · decision ${e.linkedDecisionId.slice(0, 8)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

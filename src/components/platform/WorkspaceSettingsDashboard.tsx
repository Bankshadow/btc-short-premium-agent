"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { useWorkspace, usePermission } from "@/contexts/WorkspaceContext";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import {
  environmentBadgeClass,
  TRADING_ENVIRONMENT_LABELS,
  TRADING_ENVIRONMENT_ORDER,
} from "@/lib/platform/environment";
import { listWorkspaceMembers } from "@/lib/platform/workspace-registry";
import type { Workspace, WorkspaceRole, TradingEnvironment } from "@/lib/platform/types";

type WorkspaceMemberRow = ReturnType<typeof listWorkspaceMembers>[number];
import { ALL_PERMISSIONS } from "@/lib/platform/permissions";

const ROLES: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "TRADER",
  "RISK_MANAGER",
  "VIEWER",
];

export default function WorkspaceSettingsDashboard() {
  const ws = useWorkspace();
  const canManageMembers = usePermission("canManageMembers");
  const canManageLive = usePermission("canManageLiveSettings");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("TRADER");
  const [envError, setEnvError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changeEnvironment = useCallback(
    async (env: TradingEnvironment) => {
      setBusy(true);
      setEnvError(null);
      try {
        let readiness = null;
        if (env === "LIVE_ENABLED") {
          const res = await fetch("/api/live-readiness");
          const data = await res.json();
          if (res.ok && data.serverContext) {
            readiness = buildLiveReadinessReport({
              entries: loadDecisionLog(),
              orders: loadPaperOrders(),
              riskProfile: loadDeskSettings().riskProfile,
              governance: loadGovernanceState(),
              serverContext: data.serverContext as ServerReadinessContext,
            });
          }
        }
        const result = ws.setTradingEnvironment(env, readiness);
        if (!result.ok) {
          setEnvError(result.blockers.join(" · "));
        }
      } finally {
        setBusy(false);
      }
    },
    [ws],
  );

  return (
    <OpsShell
      badge="P-MVP 1 · Platform"
      title="Workspace settings"
      subtitle="Multi-workspace platform — roles, permissions, and trading environment per workspace."
      accent="indigo"
      iconLetters="WS"
      activePath="/settings/workspace"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/governance", label: "Governance" },
        { href: "/workspace", label: "Desk profile" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Workspace" value={ws.workspace.name} hint={ws.workspace.slug} />
        <OpsKpi label="Your role" value={ws.role} hint={ws.user.displayName} />
        <OpsKpi
          label="Environment"
          value={TRADING_ENVIRONMENT_LABELS[ws.settings.tradingEnvironment as TradingEnvironment]}
          hint="Per-workspace mode"
        />
        <OpsKpi
          label="Members"
          value={String(ws.members.length)}
          hint={`ID ${ws.workspaceId.slice(0, 8)}…`}
        />
      </div>

      <section className="desk-panel px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Trading environment</h2>
        <p className="mt-1 text-xs text-zinc-500">
          LIVE_ENABLED requires all readiness gates to pass. Only OWNER or ADMIN can enable live.
        </p>
        {envError && <p className="mt-2 text-xs text-rose-400">{envError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {TRADING_ENVIRONMENT_ORDER.map((env) => {
            const active = ws.settings.tradingEnvironment === env;
            const liveLocked = env === "LIVE_ENABLED" && !canManageLive;
            return (
              <button
                key={env}
                type="button"
                disabled={busy || liveLocked}
                onClick={() => void changeEnvironment(env)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition ${
                  active
                    ? environmentBadgeClass(env)
                    : "border-zinc-700 text-zinc-400 ring-zinc-700 hover:bg-zinc-800"
                } disabled:opacity-40`}
              >
                {TRADING_ENVIRONMENT_LABELS[env]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Your profile</h2>
        <label className="mt-3 block text-xs text-zinc-500">
          Display name
          <input
            value={ws.user.displayName}
            onChange={(e) => ws.renameUser(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Your permissions</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ALL_PERMISSIONS.map((p) => (
            <li key={p} className="flex items-center justify-between text-xs text-zinc-400">
              <span>{p}</span>
              <span className={ws.permissions[p] ? "text-emerald-400" : "text-zinc-600"}>
                {ws.permissions[p] ? "Yes" : "No"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Workspaces</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace name"
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              ws.createNewWorkspace(newWorkspaceName || "New workspace");
              setNewWorkspaceName("");
            }}
            className="rounded-lg bg-indigo-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-100"
          >
            Create workspace
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {ws.workspaces.map((w: Workspace) => (
            <li key={w.id} className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2">
              <span>{w.name}</span>
              {w.id === ws.workspaceId ? (
                <span className="text-emerald-400">Active</span>
              ) : (
                <button
                  type="button"
                  onClick={() => ws.switchWorkspace(w.id)}
                  className="text-indigo-400 hover:underline"
                >
                  Switch
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Members & roles</h2>
        {!canManageMembers && (
          <p className="mt-1 text-xs text-zinc-500">Only OWNER or ADMIN can manage members.</p>
        )}
        <ul className="mt-3 space-y-2">
          {ws.members.map((m: WorkspaceMemberRow) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2 text-xs"
            >
              <span className="text-zinc-200">{m.user.displayName}</span>
              {canManageMembers ? (
                <select
                  value={m.role}
                  onChange={(e) =>
                    ws.setMemberRole(m.id, e.target.value as WorkspaceRole)
                  }
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-zinc-500">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
        {canManageMembers && (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Member name"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              {ROLES.filter((r) => r !== "OWNER").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                ws.inviteMember(inviteName, inviteRole);
                setInviteName("");
              }}
              className="rounded-lg border border-indigo-800/60 px-3 py-1.5 text-xs text-indigo-200"
            >
              Add member
            </button>
          </div>
        )}
      </section>

      <p className="text-[10px] text-zinc-600">
        Decision logs, trades, settings, and governance actions are scoped to workspace{" "}
        <code className="text-zinc-500">{ws.workspaceId}</code>.{" "}
        <Link href="/governance" className="text-indigo-400 hover:underline">
          Governance →
        </Link>
      </p>
    </OpsShell>
  );
}

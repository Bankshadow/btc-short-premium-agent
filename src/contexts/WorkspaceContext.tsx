"use client";

import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import { evaluateLiveEnableGate } from "@/lib/platform/live-enable-gate";
import type {
  TradingEnvironment,
  Workspace,
  WorkspaceContextPayload,
  WorkspaceRole,
} from "@/lib/platform/types";
import {
  addWorkspaceMember,
  buildWorkspaceContext,
  createWorkspace,
  listWorkspaceMembers,
  loadPlatformRegistry,
  setActiveWorkspace,
  updateCurrentUserDisplayName,
  updateMemberRole,
  updateWorkspaceSettings,
} from "@/lib/platform/workspace-registry";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type WorkspaceContextValue = WorkspaceContextPayload & {
  workspaces: Workspace[];
  members: ReturnType<typeof listWorkspaceMembers>;
  switchWorkspace: (workspaceId: string) => void;
  createNewWorkspace: (name: string) => void;
  setTradingEnvironment: (
    env: TradingEnvironment,
    readiness?: LiveReadinessReport | null,
  ) => { ok: boolean; blockers: string[] };
  setMemberRole: (memberId: string, role: WorkspaceRole) => void;
  inviteMember: (displayName: string, role: WorkspaceRole) => void;
  renameUser: (name: string) => void;
  refresh: () => void;
};

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    loadPlatformRegistry();
  }, []);

  const value = useMemo((): WorkspaceContextValue => {
    void tick;
    const reg = loadPlatformRegistry();
    const ctx = buildWorkspaceContext();
    return {
      ...ctx,
      workspaces: reg.workspaces,
      members: listWorkspaceMembers(),
      switchWorkspace: (workspaceId: string) => {
        setActiveWorkspace(workspaceId);
        refresh();
      },
      createNewWorkspace: (name: string) => {
        createWorkspace(name);
        refresh();
      },
      setTradingEnvironment: (env, readiness) => {
        const gate = evaluateLiveEnableGate({
          targetEnvironment: env,
          readiness: readiness ?? null,
        });
        if (!gate.allowed) return { ok: false, blockers: gate.blockers };
        if (env === "LIVE_ENABLED" && !ctx.permissions.canManageLiveSettings) {
          return {
            ok: false,
            blockers: ["Only OWNER or ADMIN can enable live environment."],
          };
        }
        updateWorkspaceSettings({ tradingEnvironment: env });
        refresh();
        return { ok: true, blockers: [] };
      },
      setMemberRole: (memberId, role) => {
        updateMemberRole(memberId, role);
        refresh();
      },
      inviteMember: (displayName, role) => {
        addWorkspaceMember({
          workspaceId: ctx.workspaceId,
          displayName,
          role,
        });
        refresh();
      },
      renameUser: (name) => {
        updateCurrentUserDisplayName(name);
        refresh();
      },
      refresh,
    };
  }, [tick, refresh]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export function usePermission(
  permission: keyof WorkspaceContextPayload["permissions"],
): boolean {
  const { permissions } = useWorkspace();
  return permissions[permission];
}

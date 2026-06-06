import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_WORKSPACE_SETTINGS,
  type PlatformRegistry,
  type PlatformUser,
  type Workspace,
  type WorkspaceContextPayload,
  type WorkspaceMember,
  type WorkspaceRole,
  type WorkspaceSettings,
} from "./types";
import { permissionsForRole } from "./permissions";
import { PLATFORM_REGISTRY_KEY } from "./constants";
import { migrateLegacyDomainToWorkspace } from "./scoped-storage";

const SCOPED_DOMAINS = [
  "decision-log",
  "governance",
  "desk-settings",
  "paper-orders",
  "paper-settings",
  "governance-audit",
  "operator-overrides",
  "incidents",
  "autopilot-settings",
  "paper-autopilot",
  "kill-switch",
  "unified-ledger",
] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function bootstrapRegistry(): PlatformRegistry {
  const now = new Date().toISOString();
  const userId = newId("user");
  const workspaceId = newId("ws");
  const user: PlatformUser = {
    id: userId,
    displayName: "Desk Operator",
    email: null,
    createdAt: now,
  };
  const workspace: Workspace = {
    id: workspaceId,
    name: "My Trading Desk",
    slug: "my-trading-desk",
    createdAt: now,
    updatedAt: now,
  };
  const member: WorkspaceMember = {
    id: newId("member"),
    workspaceId,
    userId,
    role: "OWNER",
    joinedAt: now,
  };
  return {
    version: 1,
    currentUserId: userId,
    activeWorkspaceId: workspaceId,
    users: [user],
    workspaces: [workspace],
    members: [member],
    settingsByWorkspace: {
      [workspaceId]: DEFAULT_WORKSPACE_SETTINGS(workspaceId),
    },
  };
}

export function loadPlatformRegistry(): PlatformRegistry {
  if (!isBrowser()) return bootstrapRegistry();
  try {
    const raw = localStorage.getItem(PLATFORM_REGISTRY_KEY);
    if (!raw) {
      const reg = bootstrapRegistry();
      localStorage.setItem(PLATFORM_REGISTRY_KEY, JSON.stringify(reg));
      for (const domain of SCOPED_DOMAINS) {
        migrateLegacyDomainToWorkspace(domain, reg.activeWorkspaceId);
      }
      return reg;
    }
    const parsed = JSON.parse(raw) as PlatformRegistry;
    if (!parsed.activeWorkspaceId || !parsed.workspaces?.length) {
      return bootstrapRegistry();
    }
    return parsed;
  } catch {
    return bootstrapRegistry();
  }
}

export function savePlatformRegistry(registry: PlatformRegistry): PlatformRegistry {
  if (isBrowser()) {
    localStorage.setItem(PLATFORM_REGISTRY_KEY, JSON.stringify(registry));
  }
  return registry;
}

export function getActiveWorkspaceId(): string {
  return loadPlatformRegistry().activeWorkspaceId;
}

export function getCurrentUser(): PlatformUser {
  const reg = loadPlatformRegistry();
  return (
    reg.users.find((u) => u.id === reg.currentUserId) ?? reg.users[0] ?? {
      id: "anonymous",
      displayName: "Anonymous",
      email: null,
      createdAt: new Date().toISOString(),
    }
  );
}

export function getActiveWorkspace(): Workspace {
  const reg = loadPlatformRegistry();
  return (
    reg.workspaces.find((w) => w.id === reg.activeWorkspaceId) ??
    reg.workspaces[0]
  );
}

export function getWorkspaceSettings(workspaceId?: string): WorkspaceSettings {
  const reg = loadPlatformRegistry();
  const id = workspaceId ?? reg.activeWorkspaceId;
  return (
    reg.settingsByWorkspace[id] ?? DEFAULT_WORKSPACE_SETTINGS(id)
  );
}

export function getMemberRole(
  workspaceId: string,
  userId: string,
): WorkspaceRole | null {
  const reg = loadPlatformRegistry();
  const member = reg.members.find(
    (m) => m.workspaceId === workspaceId && m.userId === userId,
  );
  return member?.role ?? null;
}

export function getCurrentMemberRole(): WorkspaceRole {
  const reg = loadPlatformRegistry();
  return getMemberRole(reg.activeWorkspaceId, reg.currentUserId) ?? "VIEWER";
}

export function buildWorkspaceContext(): WorkspaceContextPayload {
  const reg = loadPlatformRegistry();
  const workspace = getActiveWorkspace();
  const user = getCurrentUser();
  const role = getCurrentMemberRole();
  const settings = getWorkspaceSettings(workspace.id);
  return {
    workspaceId: workspace.id,
    userId: user.id,
    role,
    permissions: permissionsForRole(role),
    settings,
    workspace,
    user,
  };
}

export function setActiveWorkspace(workspaceId: string): PlatformRegistry {
  const reg = loadPlatformRegistry();
  if (!reg.workspaces.some((w) => w.id === workspaceId)) return reg;
  return savePlatformRegistry({ ...reg, activeWorkspaceId: workspaceId });
}

export function updateWorkspaceSettings(
  patch: Partial<WorkspaceSettings>,
  workspaceId?: string,
): WorkspaceSettings {
  const reg = loadPlatformRegistry();
  const id = workspaceId ?? reg.activeWorkspaceId;
  const current = getWorkspaceSettings(id);
  const next: WorkspaceSettings = {
    ...current,
    ...patch,
    workspaceId: id,
    featureFlags: { ...current.featureFlags, ...patch.featureFlags },
    updatedAt: new Date().toISOString(),
  };
  savePlatformRegistry({
    ...reg,
    settingsByWorkspace: { ...reg.settingsByWorkspace, [id]: next },
  });
  return next;
}

export function createWorkspace(name: string): Workspace {
  const reg = loadPlatformRegistry();
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id: newId("ws"),
    name: name.trim() || "New Workspace",
    slug: slugify(name) || "workspace",
    createdAt: now,
    updatedAt: now,
  };
  const member: WorkspaceMember = {
    id: newId("member"),
    workspaceId: workspace.id,
    userId: reg.currentUserId,
    role: "OWNER",
    joinedAt: now,
  };
  savePlatformRegistry({
    ...reg,
    workspaces: [...reg.workspaces, workspace],
    members: [...reg.members, member],
    settingsByWorkspace: {
      ...reg.settingsByWorkspace,
      [workspace.id]: {
        ...DEFAULT_WORKSPACE_SETTINGS(workspace.id),
        featureFlags: { ...DEFAULT_FEATURE_FLAGS },
      },
    },
    activeWorkspaceId: workspace.id,
  });
  return workspace;
}

export function updateMemberRole(
  memberId: string,
  role: WorkspaceRole,
): WorkspaceMember | null {
  const reg = loadPlatformRegistry();
  const actorRole = getCurrentMemberRole();
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") return null;
  const target = reg.members.find((m) => m.id === memberId);
  if (!target) return null;
  if (target.role === "OWNER" && role !== "OWNER" && actorRole !== "OWNER") {
    return null;
  }
  const next = reg.members.map((m) =>
    m.id === memberId ? { ...m, role } : m,
  );
  savePlatformRegistry({ ...reg, members: next });
  return next.find((m) => m.id === memberId) ?? null;
}

export function addWorkspaceMember(input: {
  workspaceId: string;
  displayName: string;
  role: WorkspaceRole;
}): WorkspaceMember | null {
  const reg = loadPlatformRegistry();
  const actorRole = getMemberRole(input.workspaceId, reg.currentUserId);
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") return null;
  const user: PlatformUser = {
    id: newId("user"),
    displayName: input.displayName.trim() || "Member",
    email: null,
    createdAt: new Date().toISOString(),
  };
  const member: WorkspaceMember = {
    id: newId("member"),
    workspaceId: input.workspaceId,
    userId: user.id,
    role: input.role,
    joinedAt: new Date().toISOString(),
  };
  savePlatformRegistry({
    ...reg,
    users: [...reg.users, user],
    members: [...reg.members, member],
  });
  return member;
}

export function listWorkspaceMembers(workspaceId?: string): Array<
  WorkspaceMember & { user: PlatformUser }
> {
  const reg = loadPlatformRegistry();
  const id = workspaceId ?? reg.activeWorkspaceId;
  return reg.members
    .filter((m) => m.workspaceId === id)
    .map((m) => ({
      ...m,
      user: reg.users.find((u) => u.id === m.userId) ?? {
        id: m.userId,
        displayName: "Unknown",
        email: null,
        createdAt: m.joinedAt,
      },
    }));
}

export function updateCurrentUserDisplayName(name: string): PlatformUser {
  const reg = loadPlatformRegistry();
  const users = reg.users.map((u) =>
    u.id === reg.currentUserId
      ? { ...u, displayName: name.trim() || u.displayName }
      : u,
  );
  savePlatformRegistry({ ...reg, users });
  return users.find((u) => u.id === reg.currentUserId)!;
}

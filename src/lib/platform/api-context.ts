import { hasPermission } from "./permissions";
import type { WorkspacePermission, WorkspaceRole } from "./types";

export const WORKSPACE_HEADERS = {
  workspaceId: "x-workspace-id",
  userId: "x-user-id",
  role: "x-workspace-role",
} as const;

export interface ApiWorkspaceContext {
  workspaceId: string | null;
  userId: string | null;
  role: WorkspaceRole | null;
}

export function parseApiWorkspaceContext(
  request: Request,
  body?: Record<string, unknown>,
): ApiWorkspaceContext {
  const h = (name: string) => request.headers.get(name)?.trim() ?? null;
  const workspaceId =
    h(WORKSPACE_HEADERS.workspaceId) ??
    (typeof body?.workspaceId === "string" ? body.workspaceId : null);
  const userId =
    h(WORKSPACE_HEADERS.userId) ??
    (typeof body?.userId === "string" ? body.userId : null);
  const roleRaw =
    h(WORKSPACE_HEADERS.role) ??
    (typeof body?.workspaceRole === "string" ? body.workspaceRole : null);

  const role =
    roleRaw === "OWNER" ||
    roleRaw === "ADMIN" ||
    roleRaw === "TRADER" ||
    roleRaw === "RISK_MANAGER" ||
    roleRaw === "VIEWER"
      ? roleRaw
      : null;

  return { workspaceId, userId, role };
}

export function enforceApiPermission(
  ctx: ApiWorkspaceContext,
  permission: WorkspacePermission,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!ctx.workspaceId || !ctx.role) {
    return {
      ok: false,
      status: 403,
      error: "Workspace context required (X-Workspace-Id, X-Workspace-Role).",
    };
  }
  if (!hasPermission(ctx.role, permission)) {
    return {
      ok: false,
      status: 403,
      error: `Permission denied: ${permission} for role ${ctx.role}.`,
    };
  }
  return { ok: true };
}

export function workspaceHeadersFromContext(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}): Record<string, string> {
  return {
    [WORKSPACE_HEADERS.workspaceId]: input.workspaceId,
    [WORKSPACE_HEADERS.userId]: input.userId,
    [WORKSPACE_HEADERS.role]: input.role,
  };
}

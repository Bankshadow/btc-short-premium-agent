"use client";

import type { WorkspacePermission } from "@/lib/platform/types";
import { usePermission } from "@/contexts/WorkspaceContext";

type Props = {
  permission: WorkspacePermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Renders children only when the active workspace role has the permission. */
export default function PermissionGate({ permission, children, fallback = null }: Props) {
  const allowed = usePermission(permission);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

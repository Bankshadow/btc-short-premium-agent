"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { workspaceHeadersFromContext } from "@/lib/platform/api-context";

/** Attach workspace context to fetch for API permission checks. */
export function useWorkspaceFetchHeaders(): Record<string, string> {
  const { workspaceId, userId, role } = useWorkspace();
  return workspaceHeadersFromContext({ workspaceId, userId, role });
}

export async function fetchWithWorkspace(
  input: string,
  init?: RequestInit,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...headers,
    },
  });
}

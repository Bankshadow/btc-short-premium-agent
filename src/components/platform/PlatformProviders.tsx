"use client";

import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

export default function PlatformProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

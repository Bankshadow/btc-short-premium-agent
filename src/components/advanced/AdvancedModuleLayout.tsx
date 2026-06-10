"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AdvancedModuleId } from "@/lib/advanced-modules/types";
import { useAdvancedModuleStatus } from "@/hooks/use-advanced-module-status";
import AdvancedModuleEngineBanner from "./AdvancedModuleEngineBanner";

export default function AdvancedModuleLayout({
  moduleId,
  children,
}: {
  moduleId: AdvancedModuleId;
  children: ReactNode;
}) {
  const { status, loading, error } = useAdvancedModuleStatus(moduleId);

  return (
    <>
      <div className="border-b border-zinc-800/80 bg-zinc-950/95">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <Link
              href="/advanced"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Advanced
            </Link>
            <h1 className="text-sm font-semibold text-zinc-100">
              {status?.label ?? moduleId}
            </h1>
          </div>
          <AdvancedModuleEngineBanner status={status} loading={loading} error={error} />
        </div>
      </div>
      {children}
    </>
  );
}

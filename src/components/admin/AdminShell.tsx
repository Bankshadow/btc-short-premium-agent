"use client";

import type { ReactNode } from "react";
import OpsShell from "@/components/ops/OpsShell";

const ADMIN_NAV = [
  { href: "/admin/health", label: "Health" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/incidents", label: "Incidents" },
  { href: "/", label: "← Cockpit" },
];

export default function AdminShell({
  title,
  subtitle,
  activePath,
  children,
}: {
  title: string;
  subtitle: string;
  activePath: string;
  children: ReactNode;
}) {
  return (
    <OpsShell
      badge="P-MVP 7 · Admin & observability"
      title={title}
      subtitle={subtitle}
      accent="rose"
      iconLetters="AD"
      activePath={activePath}
      nav={ADMIN_NAV}
    >
      {children}
    </OpsShell>
  );
}

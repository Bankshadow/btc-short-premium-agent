"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectionBundleProvider } from "@/components/projection-bundle-provider";
import type { UiProjectionData } from "@/lib/core/ui-projection-data";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/terminal", label: "Terminal" },
  { href: "/trades", label: "Trades" },
  { href: "/ai-status", label: "AI Status" },
  { href: "/polymarket", label: "Polymarket" },
  { href: "/reports", label: "Reports" },
  { href: "/core", label: "Core" },
  { href: "/operator", label: "Operator" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  children,
  initialUiBundle,
}: {
  children: React.ReactNode;
  initialUiBundle: UiProjectionData;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-[var(--ring-pop)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">v2 · testnet only</p>
            <h1 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
              BTC Short Premium Agent
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <ProjectionBundleProvider initialUiBundle={initialUiBundle}>{children}</ProjectionBundleProvider>
      </main>
    </div>
  );
}

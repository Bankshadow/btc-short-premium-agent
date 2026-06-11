import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getUiBundle } from "@/lib/core/get-ui-bundle";
import "./globals.css";

/** Journal-backed bundle must run per request, not at static build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BTC Short Premium Agent v2",
  description: "Minimal testnet AI trading loop — journal-first",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialUiBundle = await getUiBundle();

  return (
    <html lang="en">
      <body>
        <AppShell initialUiBundle={initialUiBundle}>{children}</AppShell>
      </body>
    </html>
  );
}

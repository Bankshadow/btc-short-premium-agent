"use client";

import Link from "next/link";
import {
  TRADING_OS_API_CONTRACT,
  TRADING_OS_DISCLAIMER,
} from "@/lib/trading-os/api-contract";

export default function ApiDocsDashboard() {
  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel px-4 py-4">
        <p className="desk-section-title text-cyan-400/90">MVP 15</p>
        <h1 className="text-lg font-semibold text-zinc-50">API contract</h1>
        <p className="mt-2 text-xs text-zinc-500">{TRADING_OS_DISCLAIMER}</p>
        <Link href="/workspace" className="mt-3 inline-block text-xs text-cyan-400 hover:underline">
          ← Workspace
        </Link>
      </header>

      {TRADING_OS_API_CONTRACT.map((ep) => (
        <section key={ep.path + ep.method} className="desk-panel px-4 py-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-amber-200">
              {ep.method}
            </span>
            <code className="font-mono text-sm text-cyan-300">{ep.path}</code>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{ep.summary}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Auth: {ep.auth}</p>
          {ep.query && (
            <p className="mt-1 font-mono text-[10px] text-zinc-600">Query: {ep.query}</p>
          )}
          {ep.requestBody && (
            <p className="mt-1 font-mono text-[10px] text-zinc-600">
              Body: {ep.requestBody}
            </p>
          )}
          <p className="mt-2 font-mono text-[10px] text-zinc-500">
            Response: {ep.response}
          </p>
          <ul className="mt-2 list-inside list-disc text-[10px] text-zinc-600">
            {ep.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

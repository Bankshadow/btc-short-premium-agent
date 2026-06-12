"use client";

import type { ReactNode } from "react";

export function TerminalDataTable({
  headers,
  rows,
  emptyMessage = "No data.",
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="terminal-empty">{emptyMessage}</p>;
  }
  return (
    <div className="terminal-table-wrap">
      <table className="terminal-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TerminalMetric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "block";
}) {
  return (
    <div className={`terminal-metric ${tone ? `terminal-metric--${tone}` : ""}`}>
      <span className="terminal-metric-label">{label}</span>
      <span className="terminal-metric-value">{value}</span>
      {sub ? <span className="terminal-metric-sub">{sub}</span> : null}
    </div>
  );
}

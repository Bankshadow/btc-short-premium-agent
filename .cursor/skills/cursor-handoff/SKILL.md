---
name: cursor-handoff
description: >-
  Onboards a new Cursor agent session to this btc-short-premium-agent repo —
  architecture, dashboards, MVP modules, safety invariants, build/test commands.
  Use when starting work in a fresh chat, resuming after summary, or delegating
  a task to another agent.
---

# Cursor Handoff Skill

Read this first in a new session before editing code.

## Repo layout

```
btc-short-premium-agent/
├── src/lib/          # Domain logic (prefer new features here)
├── src/app/api/      # Next.js API routes
├── src/components/   # UI (goal = simple, cockpit = advanced)
├── .cursor/skills/   # Agent skills (this folder)
└── data/             # Server JSON stores (cron journal, automation)
```

## Two dashboards

| Route | Audience | Pattern |
|-------|----------|---------|
| `/` | Mission / operator | `GoalDashboard`, `AIStatusCard` |
| `/cockpit` | Power user | `AnalyzeDashboard`, `CockpitAdvancedDrawers` |

Default UX changes go to Goal; technical panels go in Advanced drawers only.

## Recent MVP modules (know before touching)

| MVP | Module |
|-----|--------|
| 69 | `strategy-signals/` — advisory quant → desk |
| 70 | `strategy-shadow/` — virtual trades |
| 71 | `agent-os/` — Think·Act·Ask permissions |
| 72 | `ai-status/` — live status card |
| 73 | `autopilot-loop-guard/` — loop detection |
| 74 | `second-brain/` — structured memory |

## Safety invariants (never break)

- Live trading locked; testnet requires double confirm.
- Autopilot: loop guard + Agent OS + risk gate chain.
- Memory/backtest/signals are **advisory only**.
- Split client-safe modules when adding `fs` (pattern: `*-client.ts`, server stores in API routes).

## Standard verify

```bash
cd btc-short-premium-agent
npm run build
npx --yes tsx --test src/lib/<module>/<module>.test.ts
```

## Handoff checklist for parent agent

When ending a session, leave:

1. What changed (files + why)
2. Build/test status
3. Uncommitted MVPs list
4. Next integration point (usually `run-job.ts`, Goal dashboard, or API route)
5. Blockers requiring human action (env keys, testnet confirm)

## Do not

- Commit unless user asks.
- Push unless user asks.
- Create markdown docs unless requested.
- Expand scope beyond the stated MVP/task.

---
name: ux-simplification
description: >-
  Simplifies desk UX — Goal vs Cockpit split, AI Status card, operator copy,
  advanced drawers, permission prompts, alert tone. Use when adding UI features,
  reducing clutter, or moving technical detail out of the mission dashboard.
---

# UX Simplification Skill

Optimize for **operator clarity** on `/`; keep complexity in `/cockpit` Advanced drawers.

## Principles

1. **One primary action** per Goal screen — mission CTA from `build-goal-snapshot.ts`.
2. **AI Status card** is the live heartbeat — not raw logs (`AIStatusCard.tsx`, `useAiStatusCard`).
3. **Advanced only** — agent debate, technical log, memory graph, matrix panels → `CockpitAdvancedDrawers`.
4. **Plain language** — use `src/lib/ux/operator-copy.ts` patterns; avoid internal job type names on Goal.
5. **Safety visible** — "Live locked", blockers in rose, permissions in amber.

## Component map

| User need | Goal (`/`) | Cockpit (`/cockpit`) |
|-----------|------------|----------------------|
| Run cycle | Mission hero | Analyze trigger |
| AI progress | `AIStatusCard` | Same + technical log drawer |
| Testnet confirm | `TestnetTradeModal` | `BinanceTestnetDashboard` |
| Risk blocker | Risk & safety card | Risk details drawer |
| Memory/loops | Summary on status card | Second brain + loop guard drawers |

## When adding a feature

Ask:

- Can the operator decide with **one sentence** on Goal? → show summary only.
- Does it need tables, IDs, or stack traces? → Advanced drawer or `/cockpit` only.
- Does it block trading? → surface on Goal `GoalErrorBanner` + AI status permission row.

## Copy rules

- Blocker: `Autopilot paused — [reason]` not `LOOP_GUARD STUCK`.
- Next action: verb-first ("Review testnet order", "Clear loop blocker").
- Footer: link to full status (`/ai-status`) not raw API paths.

## Anti-patterns

- Duplicating the same panel on Goal and Cockpit.
- New top-level nav items for one MVP — use Advanced drawer or existing lab route.
- Replacing `AIStatusCard` with multiple status strips.
- Showing agent OS matrix on Goal (Cockpit Advanced only).

## Reference

- Operator hints: `ADVANCED_DRAWERS_HINT` in `operator-copy.ts`
- Mission flow next action: `build-mission-flow-snapshot.ts`
- UX tests: `src/lib/ux/ux-system.test.ts`

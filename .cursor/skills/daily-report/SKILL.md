---
name: daily-report
description: >-
  Builds desk daily digests and mission reports — command center export,
  automation NOTIFICATION_DIGEST, mission digest cron, smart briefing. Use when
  adding report content, scheduling digests, or formatting operator summaries.
---

# Daily Report Skill

Daily reports summarize desk state for the operator — never execute trades.

## Key paths

| Area | Path |
|------|------|
| Command center export | `src/lib/command-center/export-daily-report.ts` |
| Command center snapshot | `src/lib/command-center/evaluate-status.ts` |
| Automation digest job | `NOTIFICATION_DIGEST` in `run-job.ts` |
| Mission digest | `src/app/api/cron/mission-digest/route.ts`, `mission/digest` |
| Smart briefing | `src/lib/smart-briefing/dispatch.ts` |
| Reports UI | `src/components/trading-os/ReportsDashboard.tsx` |
| Goal snapshot | `src/lib/mission-flow/build-mission-flow-snapshot.ts` |

## Report content checklist

Include when relevant:

- Autopilot last run status + verdict
- Open testnet positions / paper trades
- Risk blockers (real-time risk, loop guard, strategy health)
- Pending operator actions
- Learning queue (testnet trades awaiting review)
- Binance connection state (testnet only)
- Second brain headline (lessons loaded this cycle)

## Digest job behavior

- `NOTIFICATION_DIGEST` runs in automation cycle after analyze/monitor.
- External channels via `dispatchExternalBriefing` — Telegram if configured.
- Sanitize text: `sanitizeBriefingText` before dispatch.
- Mark **Advisory only · no live auto-execution** in footer.

## Format template

```markdown
━━ BTC Desk · Daily Digest ━━
Date: [ISO]
Status: [desk status]
Verdict: [committee verdict]
Positions: [open summary]
Blockers: [none | list]
Next: [mission nextAction]
---
Advisory only · testnet/paper · live locked.
```

## Rules

- Do not include API secrets or raw env in reports.
- Prefer Goal/mission language on `/` digest; technical detail in Cockpit exports only.
- Run `command-center.test.ts` if changing export shape.

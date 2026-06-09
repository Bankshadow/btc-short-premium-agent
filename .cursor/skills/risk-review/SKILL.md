---
name: risk-review
description: >-
  Reviews desk risk gates — real-time risk, kill switch, governance veto,
  Agent OS, loop guard, strategy health, anomaly incidents. Use when debugging
  blocked trades, risk blockers on Goal dashboard, or hardening safety chains.
---

# Risk Review Skill

Risk layers are **final gates**. Memory, backtest, and AI suggestions cannot bypass them.

## Safety stack (order matters)

1. **Governance** — safe mode, pause analysis, hard rule locks (`governance/`)
2. **Real-time risk** — `evaluateRealTimeRisk` → `blockNewTrades`, reduce-only mode
3. **Kill switch** — daily loss, consecutive losses (`validation/kill-switch.ts`)
4. **Strategy health** — PAUSED / REVIEW_REQUIRED blocks new trades
5. **Anomaly detection** — CRITICAL incidents block risky actions
6. **Agent OS** — mode matrix (`agent-os/permission-matrix.ts`)
7. **Loop guard** — stuck/suspicious autopilot (`autopilot-loop-guard/`)
8. **Binance risk gate** — preview/execute validation + double confirm

## Key paths

| Area | Path |
|------|------|
| Real-time risk | `src/lib/real-time-risk/evaluate-realtime-risk.ts` |
| Order check API | `src/app/api/risk/check-order/route.ts` |
| Command center | `src/lib/command-center/` (desk status + blockers) |
| Goal blocker UI | `GoalDashboard.tsx` Risk & safety card |
| Incidents | `src/lib/anomaly-detection/` |
| Policy engine | `src/lib/policy-engine/` (automation DESK_ANALYZE) |

## Review workflow

1. Read current blocker from Goal snapshot (`build-server-context.ts` — risk.blocker merges loop guard + risk).
2. Trace which gate fired: search blocker text in evaluate-realtime-risk, governance, loop guard.
3. Confirm fix does **not** disable gates globally — fix root cause or operator clears blocker.
4. Re-run affected tests + `npm run build`.

## Hard rules

- Never add a code path that skips `validateOrderAgainstRiskGate` or `doubleConfirm`.
- Never enable live trading from risk review tasks.
- `ENABLE_LIVE` is always blocked in Agent OS.
- Reducing thresholds to "unblock" trades requires explicit user request and documented rationale.

## Tests

```bash
npx --yes tsx --test src/lib/real-time-risk/real-time-risk.test.ts
npx --yes tsx --test src/lib/agent-os/agent-os.test.ts
npx --yes tsx --test src/lib/autopilot-loop-guard/autopilot-loop-guard.test.ts
```

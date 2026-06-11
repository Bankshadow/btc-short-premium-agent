# Core Engine Journal Repair

Branch: **`v2-core`**  
Date: **2026-06-11**  
Scope: Repair production journal lifecycle gaps for zero-fill reconciliation trades

---

## Problem

Production journal (385 events) had:

- 7 `POSITION_CLOSED` via `RECONCILIATION_BACKFILL` (zero-fill testnet orders)
- 0 `PNL_REALIZED` — PnL calc failed with "Missing entry price"
- 0 `CLOSE_REVIEWED` before reconciliation closes
- 0 `LEARNING_RECORD_CREATED`
- Evidence 0/12 — early lifecycle events linked by `runId`/`previewId`, not `tradeId`
- 1 stale OPEN trade (`trade-1781177426006-qic688`)

---

## Fix

| Component | Change |
|-----------|--------|
| `trade-chain.ts` | Resolve evidence events via run/preview chain |
| `evidence-validator.ts` | Use trade chain instead of `tradeId`-only lookup |
| `calculate-pnl.ts` | Zero-fill path for `RECONCILIATION_BACKFILL` / qty=0 → honest `netPnl=0` |
| `journal-repair.ts` | Backfill `CLOSE_REVIEWED`, run PnL + post-trade loop, refresh positions |
| `POST /api/journal/repair` | Operator repair endpoint |

**Safety:** No fake priced PnL. Zero-fill trades record `source: ZERO_FILL_RECONCILIATION` with `netPnl=0`. Priced trades missing fill data remain `PNL_PENDING_DATA`.

---

## Usage

```bash
# Dry run (report only)
curl -X POST https://btc-short-premium-agent.vercel.app/api/journal/repair \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# Apply repair to all closed trades
curl -X POST https://btc-short-premium-agent.vercel.app/api/journal/repair \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Expected outcome

- 7 closed trades → `PNL_REALIZED` (breakeven 0), `LEARNING_RECORD_CREATED`
- Evidence up to 7/12 valid (capped by closed trade count)
- Stale OPEN reconciled via position refresh
- Core health warnings reduced (`CLOSE_WITHOUT_REVIEW`, `POSITION_CLOSED_WITHOUT_PNL`)

Assign **`CORE_ENGINE_STABLE`** after production repair + page/API verification.

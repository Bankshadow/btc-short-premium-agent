# MVP 8 — Evidence 12 Trades Plan

Date: 2026-06-11  
Branch: `v2-core`

## Preconditions verified

| Check | Status |
|-------|--------|
| UI binding (`REAL_BUNDLE`, 8 trades) | ✅ Production verified |
| MVP 6 PnL pipeline (`PNL_REALIZED` / `PNL_PENDING_DATA`) | ✅ Implemented |
| MVP 7 learning (`LEARNING_RECORD_CREATED`, `TRADE_REFLECTION_COMPLETED`) | ✅ Implemented |

## 1. Current evidence logic (before MVP 8)

- `validateTradeEvidence()` checked 11 lifecycle events (missing `TRADE_RESULT_CLASSIFIED`, `TRADE_REFLECTION_COMPLETED`)
- Readiness statuses: `COLLECTING` / `COMPLETE` / `BLOCKED`
- Progress engine mixed rejected trades with blocked readiness
- Summary events written on every recalculate (not idempotent)

## 2. Existing valid/rejected rules

Valid required full lifecycle + realized PnL + learning. Rejected for pending PnL, missing prices, zero qty, incomplete lifecycle.

## 3. Required lifecycle events (strict)

`ANALYSIS_STARTED` → `VERDICT_CREATED` → `PREVIEW_CREATED` → `EXECUTION_REVIEWED` → `ORDER_EXECUTED` → `POSITION_OPENED` → `POSITION_MONITORED` → `CLOSE_ORDER_EXECUTED` → `POSITION_CLOSED` → `PNL_REALIZED` → `TRADE_RESULT_CLASSIFIED` → `LEARNING_RECORD_CREATED` → `TRADE_REFLECTION_COMPLETED`

## 4. Current gaps

- No explicit `EvidenceReadinessStatus` enum aligned to testnet continuation
- No pending/rejected split in projection
- No `/api/evidence/validate` or `/api/evidence/rejected`
- Trace view lacked evidence validation payload
- UI used legacy `COLLECTING` / `COMPLETE` labels

## 5. Safety constraints

- Read-only validation — never creates missing lifecycle events
- Never marks live ready (`READY_FOR_LIVE_TRADING` excluded)
- Pending PnL trades never valid
- Realized PnL without learning/reflection rejected
- No secret exposure in API payloads

## 6. Acceptance criteria

- `/api/evidence/progress` returns strict `EvidenceProgress`
- `/api/evidence/validate` idempotent summary events
- Projection bundle evidence uses strict validator
- Reports/Core/Trades/Dashboard show 12-trade progress
- `npm run build` passes

# MVP 8 — Evidence 12 Trades Implementation

Date: 2026-06-11  
Branch: `v2-core`

## Evidence definition

A trade counts as **valid evidence** only when the full safe lifecycle exists: analysis → preview → execution review → order → open → monitor → close order → position closed → **realized PnL** → result classified → **learning record** → **trade reflection completed**.

## Required lifecycle

See `EVIDENCE_LIFECYCLE_REQUIREMENTS` in `src/lib/evidence/evidence-types.ts`.

## Valid / rejected rules

Implemented in `validateEvidenceTrade()` (`src/lib/evidence/evidence-validator.ts`):

- Rejects `CLOSED_PENDING_PNL`, `PENDING_PNL`, `PENDING_DATA`
- Rejects missing entry/exit price, zero qty, missing PnL/learning/reflection
- Rejects LIVE environment and critical reconciliation issues
- Accepts only WIN/LOSS/BREAKEVEN with realized PnL

## Readiness statuses

| Status | When |
|--------|------|
| `NOT_READY` | 0 valid trades |
| `IN_PROGRESS` | 1–11 valid trades |
| `READY_FOR_TESTNET_CONTINUATION` | ≥12 valid, no safety blockers |
| `BLOCKED_BY_SAFETY` | Critical reconciliation / live / secret risk |

Never emits `READY_FOR_LIVE_TRADING`.

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/evidence/progress` | Strict progress snapshot |
| `POST /api/evidence/validate` | Validate one or all trades, write summary events |
| `GET /api/evidence/trades` | All trade validations |
| `GET /api/evidence/rejected` | Rejected trades + reasons |
| `GET /api/core/trace/[id]?view=evidence` | Trace + evidence validation |

## Projection changes

`buildEvidenceProgress()` in `evidence-progress-engine.ts` powers `buildEvidenceProjection()` with:

- `valid`, `rejected`, `pending`, `progressPct`, `readinessStatus`
- `validTradeIds`, `blockingReasons`, `latestValidatedAt`

## UI changes

- **Dashboard:** Evidence 12 Trades card + not live-ready note
- **Reports:** Evidence summary section, rejection reasons, valid/rejected lists
- **Core:** Evidence readiness panel + blocking reasons
- **Trades:** Per-trade evidence status + missing requirements

## Events added

- `EVIDENCE_VALIDATION_STARTED`
- `EVIDENCE_READINESS_UPDATED`

Existing: `EVIDENCE_TRADE_VALIDATED`, `EVIDENCE_TRADE_REJECTED`, `EVIDENCE_PROGRESS_UPDATED`

## Test results

Suite: `src/lib/evidence/mvp8-evidence-12-trades.test.ts`  
Run: `npm test` · Build: `npm run build`

## Known limitations

Production journal has 8 closed trades, 0 valid evidence (all pending PnL / incomplete lifecycle). Requires MVP 6 + MVP 7 completion per trade before evidence counts.

## Next MVP recommendation (MVP 9)

Automated batch pipeline: backfill fills → calculate PnL → create learning → validate evidence for all pending closed testnet trades.

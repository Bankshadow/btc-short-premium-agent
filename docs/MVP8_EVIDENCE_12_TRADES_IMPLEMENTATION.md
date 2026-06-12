# MVP 8 — Evidence 12 Trades Implementation

Date: 2026-06-11 (updated 2026-06-12)  
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

## Evidence collection phase policy

MVP 8 strict validation and MVP risk discipline can conflict during the **evidence sprint** (collecting the first 12 valid trades). The system derives phase from progress:

```text
evidenceCollectionActive = validTrades < EVIDENCE_REQUIRED_TRADES (12)
```

### Phase A — Collection (`validTrades < 12`)

Goal: complete 12 full-lifecycle testnet trades with real fills, realized PnL, and learning — without bypassing safety or live gates.

| Rule / gate | Behavior during collection | Rationale |
|-------------|---------------------------|-----------|
| `REPEATED_SETUP_FAILURE` (no-trade) | **WARN** (advisory) | 2+ consecutive losses must not stop the evidence sprint |
| `CONSECUTIVE_LOSSES` (no-trade) | **WARN** (advisory) | Same — streak limits apply after collection |
| `CONSECUTIVE_LOSSES` (portfolio risk) | **WARNING** (non-blocking) | Execute guard reads portfolio risk; must align with no-trade |
| Portfolio cooldown after consecutive losses | **Skipped** | Cooldown starts only after ≥12 valid evidence trades |
| `DAILY_LOSS_LIMIT` | **BLOCK** | Hard loss cap unchanged |
| `ENGINE_HEALTH_BLOCKED` | **BLOCK** | Unchanged |
| `BINANCE_DISCONNECTED` | **BLOCK** | Unchanged |
| Live lock / double confirm / execution safety | **BLOCK** | Unchanged — testnet only, never live |

Implementation:

- `src/lib/rules/no-trade-rule-engine.ts` — severity `WARN` vs `BLOCK` from `buildEvidenceProgressFromEvents()`
- `src/lib/portfolio-risk/portfolio-risk-manager.ts` — consecutive-loss issue downgraded; cooldown gated on ≥12 valid

`REPEATED_SETUP_FAILURE` counts **consecutive** losses (most recent streak), not total historical losses.

### Phase B — Testnet continuation (`validTrades ≥ 12`)

Readiness becomes `READY_FOR_TESTNET_CONTINUATION`. Risk discipline **returns to normal**:

- `REPEATED_SETUP_FAILURE` and `CONSECUTIVE_LOSSES` → **BLOCK** again when thresholds hit
- Analysis may return `verdict: BLOCKED` with `noTradeBlockReason` even though evidence is complete
- **Live remains locked** — this phase is not live-ready

Production verified (2026-06-12): after 12/12 valid, `POST /api/analysis/run` correctly blocked with `REPEATED_SETUP_FAILURE` severity `BLOCK`.

### Legacy pending trades (separate bucket)

Eight early reconciliation-backfill closed trades remain **pending/rejected** (zero qty, no fill data). They:

- Do **not** count toward the 12 valid evidence trades
- Should **not** block new evidence collection once phase policy is active
- Require MVP 9 fill backfill if they are ever to become valid (optional; not required for MVP 8 acceptance)

UI recommendation: show **valid 12**, **legacy pending 8**, and **phase** (`COLLECTING` vs `CONTINUATION READY`) as separate lines — do not merge counts.

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

## Production verification (2026-06-12)

| Check | Result |
|-------|--------|
| Valid evidence trades | **12 / 12** |
| Readiness | `READY_FOR_TESTNET_CONTINUATION` |
| Live locked | Yes |
| Legacy reconciliation trades | 8 pending (excluded from valid count) |
| Deploy tip | `5e80560` on `v2-core` |

Related commits for collection-phase policy:

- `c348139` — `REPEATED_SETUP_FAILURE`: consecutive streak + WARN while `< 12` valid
- `037be3f` — `CONSECUTIVE_LOSSES` no-trade: WARN while `< 12` valid
- `5e80560` — portfolio risk consecutive-loss + cooldown aligned with collection phase

## Known limitations

- Legacy 8 closed trades from reconciliation backfill lack Binance fill data; strict validator correctly rejects them.
- Collection-phase relaxations are **derived from valid count**, not an operator toggle. MVP 9 may add explicit `EVIDENCE_COLLECTION_MODE` and a shared `isEvidenceCollectionActive()` helper (currently duplicated in no-trade + portfolio-risk).
- Evidence completion does not imply strategy profitability; it only proves repeatable safe lifecycle on testnet.

## Next MVP recommendation (MVP 9)

1. Automated batch pipeline: backfill fills → calculate PnL → create learning → validate evidence for legacy pending trades (optional).
2. Shared evidence-phase policy module + dashboard phase/legacy buckets.
3. Operator-visible “testnet continuation” checklist (post-12/12), distinct from live readiness.

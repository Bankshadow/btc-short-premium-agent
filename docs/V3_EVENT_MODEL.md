## PnL lifecycle events

## PnL lifecycle events

| Event | When emitted |
|-------|----------------|
| `PNL_CALCULATION_STARTED` | PnL processor begins for a closed trade |
| `PNL_PENDING_DATA` | Required fill/validation data incomplete — includes `reasons[]` |
| `PNL_REALIZED` | Valid PnL calculated from complete fill data |
| `TRADE_RESULT_CLASSIFIED` | After `PNL_REALIZED` — WIN / LOSS / BREAKEVEN |
| `MISSION_SNAPSHOT_UPDATED` | After `PNL_REALIZED` — mission equity/netPnl refresh |

## `PNL_PENDING_DATA` payload

```typescript
{
  tradeId: string;
  positionId: string | null;
  reasons: PnlPendingDataReason[];
  message: string;
  qty: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
}
```

## Rules

- Never emit `PNL_REALIZED` when validation fails
- Never emit `TRADE_RESULT_CLASSIFIED` without prior `PNL_REALIZED`
- Duplicate `PNL_REALIZED` for same `tradeId` is forbidden (idempotent processor)

## Evidence lifecycle events (MVP 8)

| Event | When emitted |
|-------|----------------|
| `EVIDENCE_VALIDATION_STARTED` | Evidence validation run begins |
| `EVIDENCE_TRADE_VALIDATED` | Trade passes strict evidence checks |
| `EVIDENCE_TRADE_REJECTED` | Trade fails evidence checks |
| `EVIDENCE_PROGRESS_UPDATED` | Progress snapshot updated |
| `EVIDENCE_READINESS_UPDATED` | Readiness status changed |

Summary event payloads include `validationId`, `tradeId`, `isValid`, `rejectedReasons`, `missingEvents`, `readinessStatus`, `safeToReplay: true`.

Evidence validation is read-only — it never mutates trade lifecycle events.

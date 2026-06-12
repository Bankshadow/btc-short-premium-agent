# MVP 6 — PnL Fill Data Implementation

Date: 2026-06-11  
Branch: `v2-core`

## Summary

Implemented a strict realized-PnL pipeline for testnet closed trades. Incomplete fill data produces `PNL_PENDING_DATA` journal events with explicit reasons — never fake `PNL_REALIZED`.

## PnL formula

**LONG:** `grossPnl = (exitPrice - entryPrice) × qty`  
**SHORT:** `grossPnl = (entryPrice - exitPrice) × qty`  
**Net:** `netPnl = grossPnl - entryFee - exitFee`  
**Pct:** `pnlPct = netPnl / (entryPrice × qty) × 100`

## Required fields

See `PnlInput` in `src/lib/pnl/pnl-types.ts`.

## Pending reasons

`MISSING_TRADE_ID`, `MISSING_POSITION_ID`, `ZERO_QTY`, `MISSING_ENTRY_PRICE`, `MISSING_EXIT_PRICE`, `INVALID_SIDE`, `MISSING_CLOSE_EVENT`, `MISSING_FILL_DATA`, `LIVE_ENV_BLOCKED`, `INVALID_TIMestamps`

## Safety rules

- Live PnL blocked when `isLiveEnabled()` or `environment === LIVE`
- No secrets in `/api/pnl/*` responses
- Duplicate `PNL_REALIZED` prevented (idempotent processor)
- Zero-fill reconciliation no longer writes fake breakeven PnL
- Evidence validator unchanged — strict rejection of pending trades

## APIs

### `POST /api/pnl/calculate`

Body: `{ tradeId?: string, positionId?: string }`

Response:

```json
{
  "ok": true,
  "status": "REALIZED | PENDING_DATA | BLOCKED",
  "tradeId": "...",
  "positionId": "...",
  "pnl": { "...": "RealizedPnlRecord or null" },
  "reasons": ["MISSING_ENTRY_PRICE"],
  "eventsWritten": 2
}
```

### `GET /api/pnl/pending`

Returns closed trades without `PNL_REALIZED` and their pending reasons.

## Events added

| Event | Purpose |
|-------|---------|
| `PNL_PENDING_DATA` | Records why PnL cannot be calculated |

Existing events used: `PNL_CALCULATION_STARTED`, `PNL_REALIZED`, `TRADE_RESULT_CLASSIFIED`, `MISSION_SNAPSHOT_UPDATED`

## Projections

`buildPnlProjection()` now includes:

- `realizedCount`
- `pendingCount` (closed − realized)
- `totalNetPnl` (sum of `PNL_REALIZED` only)

Mission snapshot already sums only `PNL_REALIZED` events.

## UI

- **Trades:** realized/pending counts, pending reasons, **Calculate PnL** button
- **Core:** realized / pending PnL in projection diagnostic bar
- **Reports:** pending PnL count (existing panel retained)

## Test results

Run: `npm test`

New suite: `src/lib/pnl/mvp6-pnl-pipeline.test.ts`

Covers: LONG/SHORT math, fees, zero qty, missing prices, live block, idempotency, lifecycle events, evidence strictness, no secrets, live locked.

Build: `npm run build`

## Known limitations

1. Production journal still lacks entry/exit prices on most trades — `/api/pnl/pending` explains per-trade reasons
2. Binance fill backfill read path not yet wired into engine (future: read testnet order API when configured)
3. `positionId` falls back to `tradeId` for legacy events without explicit position id
4. Post-trade loop (learning/evidence) only runs after successful `PNL_REALIZED`

## Next MVP recommendation (MVP 7)

**Fill data backfill from Binance testnet read APIs:** enrich `ORDER_EXECUTED` / `CLOSE_ORDER_EXECUTED` payloads from exchange fills, then re-run `/api/pnl/calculate` idempotently for pending trades.

# MVP 21.1 — Polymarket Sweeper Opportunity Scanner

Paper-only order book scanner for sweepable Polymarket setups. **No wallet signing, no real orders, no private keys.**

## Strategies

| Strategy | Code | Detection logic |
|----------|------|-----------------|
| Binary under-$1 arbitrage | `BINARY_UNDER_ONE_ARB` | YES ask + NO ask &lt; $1 |
| Dump-and-hedge | `DUMP_AND_HEDGE` | YES bid dump vs mid → hedge via NO |
| Wide-spread capture | `WIDE_SPREAD_CAPTURE` | YES spread ≥ 75% of max spread threshold |
| Crypto market lag | `CRYPTO_MARKET_LAG` | Polymarket YES lags fair prob after crypto move |
| Near-expiry liquidity gap | `NEAR_EXPIRY_LIQUIDITY_GAP` | &lt;15 min to expiry + thin book or wide spread |

## Safety

- `realTradingEnabled` is hard-coded `false`
- Risk guard (`checkSweeperOpportunityRisk`) runs before every simulated trade
- Kill switch, stale data, exposure caps, spread/liquidity limits
- Every blocked opportunity → store + journal (`SWEEPER_OPPORTUNITY_BLOCKED`)

## Module layout

```
src/lib/polymarket/
  sweeper-types.ts          # Types
  adapters/mock-order-book-adapter.ts
  sweeper-scanner.ts        # 5 strategy scanners
  sweeper-risk.ts           # Pre-trade risk guard
  sweeper-paper.ts          # Paper fill simulator
  run-sweeper-cycle.ts      # Orchestrator
  mvp21-sweeper.test.ts     # Tests
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/polymarket/sweeper/run` | Run sweeper scan cycle |
| `GET` | `/api/polymarket/sweeper/opportunities` | Latest opportunities, blocked, paper trades |
| `POST` | `/api/polymarket/run` | Main cycle (also runs sweeper at end) |
| `GET` | `/api/polymarket/status` | Dashboard data includes sweeper fields |

## Journal events

- `SWEEPER_SCAN_STARTED`
- `SWEEPER_OPPORTUNITY_DETECTED`
- `SWEEPER_OPPORTUNITY_BLOCKED`
- `SWEEPER_PAPER_TRADE_CREATED`
- `SWEEPER_SCAN_COMPLETED`

## Dashboard

`/polymarket` → Section **F · Sweeper opportunity scanner**

- Run sweeper scan button
- Opportunities table
- Sweeper paper trades
- Blocked opportunities in Section E risk log

## Tests

```bash
npx tsx --test src/lib/polymarket/mvp21-sweeper.test.ts
```

## Mock markets

Special mock markets inject order book scenarios:

- `pm-binary-arb-mock` — bundle ask &lt; $1
- `pm-btc-dump-hedge` — YES dump scenario
- `pm-near-expiry-gap` — near expiry + wide spread

## Persistence

Same store as MVP 21: local `data/polymarket/` or `/tmp/polymarket` on Vercel (ephemeral).

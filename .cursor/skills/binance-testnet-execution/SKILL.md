---
name: binance-testnet-execution
description: >-
  Guides Binance USD-M Futures testnet order preview and execution in this
  desk — double confirm, risk gate, loop guard, Agent OS permissions, autopilot
  auto-execute. Use when implementing or debugging testnet trades, previews,
  execute routes, or BINANCE_TESTNET_AUTOEXECUTE.
---

# Binance Testnet Execution

Testnet-only. Production orders are hard-blocked. Live trading stays locked.

## Key paths

| Area | Path |
|------|------|
| Preview build | `src/lib/exchange/binance/binance-order-preview.ts` |
| Execute | `src/lib/exchange/binance/binance-execution.ts` |
| Autopilot executor | `src/lib/exchange/binance/binance-auto-executor.ts` |
| API execute | `src/app/api/exchange/binance/testnet/execute/route.ts` |
| API preview | `src/app/api/exchange/binance/preview/route.ts` |
| Config | `src/lib/exchange/binance/binance-config.ts` |

## Safety chain (never skip)

1. **Anomaly gate** — `evaluateRiskyActionGate("binance testnet execute")`
2. **Loop guard hard safety** — `checkOrderHardSafety` (double confirm, no duplicate preview/order, no blind retry)
3. **Risk gate** — `validateOrderAgainstRiskGate` (requires `doubleConfirm: true`)
4. **Agent OS** — `EXECUTE_TESTNET_ORDER` permission in assisted modes
5. **Journal dedup** — block if previewId already SUBMITTED/FILLED/CLOSING/CLOSED

## Implementation rules

- Always pass `doubleConfirm: true` for autopilot; manual UI must show explicit second confirm.
- Never retry a failed execute without operator review (`blindRetry` blocked).
- Autopilot path: `runBinanceTestnetAutoExecute` → `pickAutopilotTradeCandidates` → preview → execute per slot.
- Record outcomes via `recordTestnetTradeJournal`; emit `ORDER_EXECUTED` / `PERMISSION_REQUESTED` on AI status pipeline.
- Env: `BINANCE_TESTNET_ENABLED`, `BINANCE_TESTNET_AUTOEXECUTE_ENABLED` (auto path only).

## When changing execute flow

1. Read `binance-execution.ts` and `binance-auto-executor.ts` together.
2. Preserve duplicate-preview fingerprint guard in auto-executor loop.
3. Run `src/lib/exchange/binance/binance.test.ts` and `npm run build`.
4. Do not weaken risk gate or remove double confirm for convenience.

## Operator surfaces

- Goal dashboard: `TestnetTradeModal`, pending preview queue
- Cockpit: `BinanceTestnetDashboard`, analyze flow preview enqueue
- Monitor: `/binance-testnet/monitor`, `BINANCE_TESTNET_MONITOR` job

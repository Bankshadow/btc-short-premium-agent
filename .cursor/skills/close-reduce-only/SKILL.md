---
name: close-reduce-only
description: >-
  Guides reduce-only testnet position closes on Binance futures — close side
  resolution, double confirm, monitor auto-close, anomaly detection. Use when
  closing positions, fixing close failures, or wiring testnet monitor close paths.
---

# Close Reduce-only Skill

Closing testnet positions must use **reduce-only** market orders — never flip exposure.

## Key paths

| Area | Path |
|------|------|
| Close execution | `executeBinanceTestnetClose` in `binance-execution.ts` |
| Exchange call | `closeTestnetPositionReduceOnly` in `binance-futures-testnet.ts` |
| Close side helper | `closeSideForPosition` in `binance-position-monitor.ts` |
| Auto monitor close | `binance-auto-monitor.ts` |
| Manual API | `src/app/api/testnet-monitor/close/route.ts` |
| UI | `src/components/goal/TestnetTradeModal.tsx` |

## Close workflow

1. Load open position for symbol (`getPositions`).
2. Resolve close side: LONG position → SELL reduce-only; SHORT → BUY reduce-only.
3. Require **double confirm** on manual close (`doubleConfirm` in route body).
4. Run anomaly gate + risk checks same as open path.
5. Journal status: CLOSING → CLOSED (or FAILED with `closeFailed`).

## Failure handling

- Anomaly detector watches reduce-only failures: `src/lib/anomaly-detection/detect.ts` ("Close reduce-only failed").
- On repeated close errors: do **not** blind-retry — surface blocker, operator verifies position on exchange.
- Loop guard treats duplicate close attempts like duplicate orders.

## Rules

- `reduceOnly: true` on every close order payload.
- Never open opposite-side market order to "close" — use reduce-only API only.
- Autopilot monitor may auto-close on stop/TP rules; still journal + emit `TRADE_CLOSED` on AI status.
- Test close side logic: `binance.test.ts` ("picks reduce-only close side").

## Verify after changes

```bash
npx --yes tsx --test src/lib/exchange/binance/binance.test.ts
npm run build
```

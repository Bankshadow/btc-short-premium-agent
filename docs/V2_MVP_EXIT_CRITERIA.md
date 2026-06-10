# V2 MVP Exit Criteria

Branch: **`v2-core`**

Each MVP is **done** only when its loop contract is complete and the checklist below passes. Do not start the next MVP until the current one meets exit criteria.

Related:

- [V2_LOOP_CONTRACTS.md](./V2_LOOP_CONTRACTS.md) — loop definitions
- `.cursor/rules/v2-loop-engineering.md` — engineering guardrails

---

## General exit rules (all MVPs)

- [ ] Loop contract documented and accurate in `V2_LOOP_CONTRACTS.md`
- [ ] Journal events appended for all durable state changes
- [ ] Stop conditions implemented and tested
- [ ] UI reads APIs only (no client source-of-truth)
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Live trading remains locked
- [ ] No auto-execute or auto-close introduced

---

## MVP 5 — Position Monitor & Reduce-only Close

**Loop:** [Position Monitor / Close Loop](./V2_LOOP_CONTRACTS.md#5-position-monitor--close-loop)  
**Readiness flag:** `readyForMvp5` on Dashboard and Reports (true only when full pre-MVP-5 execution evidence exists)

### Functional exit criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | OPEN trade exists | `/api/trades` → `open.length >= 1`; Trades page shows OPEN row |
| 2 | `POSITION_MONITORED` event exists | `/api/journal/events` or AI Status shows latest monitor event |
| 3 | Dashboard shows position | `/` displays symbol, side, qty, entry/mark, unrealized PnL, last refreshed |
| 4 | Reconciliation OK or warning displayed | Dashboard/Reports show reconciliation status; `GET /api/positions/reconciliation` |
| 5 | Close preview can be created | `POST /api/execution/testnet/close-preview` → `CLOSE_PREVIEW_CREATED` for OPEN `tradeId` |
| 6 | Close preview `reduceOnly = true` | Preview payload and tests assert `reduceOnly === true` |
| 7 | Close blocks without double confirm | `POST /api/execution/testnet/close` with `doubleConfirm: false` → blocked, no order |
| 8 | Close writes `CLOSE_ORDER_EXECUTED` | Journal contains event after successful close |
| 9 | `POSITION_CLOSED` when flat | After full reduce-only close, journal contains `POSITION_CLOSED`; trade leaves open list |

### Safety exit criteria

- [ ] Close is testnet only; live paths blocked
- [ ] Close requires `doubleConfirm: true`
- [ ] Close order is MARKET **reduce-only** only
- [ ] Close blocked when position `UNKNOWN`
- [ ] Close blocked when Binance not `CONNECTED`
- [ ] Close blocked when close preview expired
- [ ] Close blocked when kill switch active
- [ ] No force close; no reverse position; no auto-close

### Test evidence

File: `src/lib/mvp5-position-close.test.ts`

- [ ] Refresh returns zero-state when no open trades
- [ ] Refresh appends `POSITION_MONITORED`
- [ ] Reconciliation warns on local/Binance mismatch
- [ ] Close preview requires OPEN trade and active position
- [ ] Close preview always `reduceOnly`
- [ ] Close blocks without double confirm
- [ ] Close blocks on `UNKNOWN`, disconnected Binance, expired preview, `reduceOnly false`
- [ ] Successful close appends `CLOSE_ORDER_EXECUTED` and `POSITION_CLOSED` when flat
- [ ] No API secret in status payloads

### UI / API evidence

| Surface | Expected |
|---------|----------|
| Dashboard | Open position panel, Refresh position, Review close |
| Trades | OPEN trade + position snapshot, Review close |
| AI Status | `POSITION_MONITORED`, close events, reconciliation warning |
| Reports | Position monitor stats, reconciliation status |
| APIs | `GET /api/positions/open`, `POST /api/positions/refresh`, close-preview, close |

### Explicit non-goals (MVP 5)

- Realized PnL calculation (MVP 6 — PnL Loop)
- Learning records (Learning Loop)
- Live trading
- Auto-close

---

## MVP 6 — PnL Loop (planned)

Exit criteria to be filled when MVP 6 starts. Minimum bar:

- [ ] `PNL_REALIZED` appended with correct `tradeId` linkage
- [ ] Mission equity updates from journal
- [ ] Reports show non-pending realized PnL for closed trades
- [ ] Stop conditions tested (missing entry/exit)
- [ ] Loop contract section 6 complete in `V2_LOOP_CONTRACTS.md`

---

## MVP 7+ — Learning Loop (planned)

Exit criteria to be filled when Learning MVP starts. Minimum bar:

- [ ] `LEARNING_CREATED` appended with `tradeId` + `decisionLogId`
- [ ] Reports learning count matches journal
- [ ] Stop conditions tested (missing IDs)
- [ ] Loop contract section 7 complete in `V2_LOOP_CONTRACTS.md`

---

## Quick verification commands (local)

```bash
npm test
npm run build
```

Optional manual smoke (testnet configured):

1. Start AI → verify `runId` / `decisionLogId` on Dashboard  
2. Execute testnet open (double confirm) → verify OPEN trade  
3. Refresh position → verify Dashboard position  
4. Review close → create preview → double confirm close → verify `POSITION_CLOSED`

---

## Sign-off template

```text
MVP: ___
Date: ___
Branch: v2-core
Loop(s): ___
Tests: pass / fail
Build: pass / fail
Evidence links: journal events, screenshots, API responses
Blockers: ___
Signed off: yes / no
```

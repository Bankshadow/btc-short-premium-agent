# V2 Safety Rules

Branch: **`v2-core`**

Non-negotiable safety rules for v2. Every implementation change must comply. These rules exist because v1 accumulated trading paths that were hard to audit; v2 enforces safety in **server-side gates**, not UI honor system.

Related: [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) · [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md)

---

## Rule summary

| # | Rule | Enforcement layer |
|---|------|-------------------|
| 1 | Live trading locked | `risk` config + gate; no live client in v2 |
| 2 | Testnet only | `BINANCE_TESTNET_ENABLED`; environment on events |
| 3 | No auto execute | No cron/worker may call execute without operator action |
| 4 | Double confirm required | Risk gate + API body flag + UI checkboxes |
| 5 | No force execute | No bypass flag, no admin override route |
| 6 | Execute disabled if blocked | Gate returns block reasons; UI disables button |
| 7 | Close must be reduce-only | Execution client uses `reduceOnly: true` |
| 8 | No browser-side secrets | API keys server env only |
| 9 | No UI-only trading state | All trade/mission state from journal via APIs |
| 10 | No advanced features before core loop stable | Architecture scope gate |

---

## 1. Live trading locked

- `BINANCE_LIVE_ENABLED` and `LIVE_EXECUTION_ENABLED` must remain **`false`**.
- v2-core must not ship a live exchange client, live order route, or live base URL default.
- If live env flags are detected at runtime, risk gate **blocks** execution and surfaces a blocker in mission snapshot.
- Branch `main` may retain v1 live reference code; **`v2-core` must not activate it**.

**Acceptance:** No code path on `v2-core` can place a live order even with env misconfiguration alone — gate must fail closed.

---

## 2. Testnet only

- All journal events use `environment: "testnet"`.
- Binance connectivity targets testnet/demo futures base URL only.
- Execute and close APIs reject when testnet is disabled or disconnected.
- UI shows testnet status from `GET /api/binance/status`; disconnected state blocks actions.

**Acceptance:** Execute and close return blocked when `BINANCE_TESTNET_ENABLED=false` or ping fails.

---

## 3. No auto execute

- Analysis may produce a `TRADE` verdict, but **no automatic order placement** follows.
- No background job, webhook, or “AUTOEXECUTE=true” path in v2-core.
- Flow always stops at `PREVIEW_CREATED` until operator opens execute modal and confirms.

**Acceptance:** Verdict `TRADE` alone never produces `ORDER_EXECUTED` without a separate confirmed execute API call.

---

## 4. Double confirm required

- Execute and close require **`doubleConfirm: true`** in API request body when `BINANCE_REQUIRE_DOUBLE_CONFIRM=true` (default).
- UI must present **two explicit checkboxes** (not one, not pre-checked).
- Risk gate rejects execute/close if double confirm is missing.

**Suggested checkbox semantics (execute):**

1. “I confirm this is testnet only (live locked).”
2. “I confirm order details and accept execution risk.”

**Suggested checkbox semantics (close):**

1. “I confirm reduce-only close on testnet.”
2. “I understand PnL will be realized and journaled.”

**Acceptance:** `POST /api/execution/testnet/execute` with `doubleConfirm: false` → blocked + `EXECUTE_BLOCKED` journal event.

---

## 5. No force execute

- No `FORCE_EXECUTE`, `FORCE_MAX`, or operator bypass endpoints.
- No “debug execute” routes in v2-core.
- Kill switch and blockers cannot be overridden from UI.

**Acceptance:** Grep for force/bypass flags in v2 execution paths returns zero active bypass logic.

---

## 6. Execute disabled if blocked

Execute is blocked when **any** of the following is true:

| Blocker | Check |
|---------|--------|
| Live enabled flag detected | Config |
| Testnet disabled | Config |
| Testnet disconnected | Binance ping |
| Kill switch active | Kill switch state |
| Missing `previewId` | Request |
| Missing `decisionLogId` | Preview link |
| Preview not found | Journal |
| Preview expired | TTL |
| Duplicate preview already executed | Journal |
| Notional exceeds max | Config |
| Symbol not in allowlist | Config |
| Double confirm not provided | Request |

- Block reasons are returned to client and appended as `EXECUTE_BLOCKED` when appropriate.
- UI **disables** Execute button when blockers present; shows “Resolve blockers first” messaging.
- Never show an enabled Execute button that silently fails — either disabled or explicit error.

**Acceptance:** Dashboard execute modal disabled when `riskStatus === "BLOCKED"` or testnet disconnected.

---

## 7. Close must be reduce-only

- Close API places **market reduce-only** order only — never flips or increases exposure.
- Close requires double confirm (same gate family as execute).
- Close blocked when testnet disconnected or live lock violated.
- Journal records `closeReason: "reduce-only"` on `POSITION_CLOSED`.

**Acceptance:** Execution close function sets `reduceOnly: true` on Binance order params; no non-reduce close route exists.

---

## 8. No browser-side secrets

- `BINANCE_API_KEY` and `BINANCE_API_SECRET` exist in **server environment only** (`.env.local`, deployment secrets).
- No `NEXT_PUBLIC_*` Binance keys.
- No storing keys in localStorage, sessionStorage, or client components.
- Settings page shows **configuration status** only (connected/disconnected, base URL) — never key material.

**Acceptance:** Client bundle and browser network tab never contain API secret values.

---

## 9. No UI-only trading state

- Dashboard, Trades, AI Status, and Reports **fetch from APIs** on load/refresh.
- UI must not maintain authoritative lists of open trades, mission PnL, or verdict history in React state beyond transient modal/form state.
- After execute/close, UI refreshes from APIs — does not optimistically patch mission numbers as source of truth.
- If refresh fails, show error — do not keep stale “success” mission state.

**Acceptance:** Removing journal file and refreshing UI shows empty/zero state, not cached trades in UI memory across hard reload.

---

## 10. No new advanced feature before core loop stable

- Do not add v1-style subsystems (reconciliation, regime brain, live pilot, evidence-quality engine, agent-os) until [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) stability checklist passes.
- Bug fixes and safety hardening within core modules are allowed.
- New pages, routes, or modules outside the defined v2-core set require architecture doc update and explicit approval.

**Acceptance:** PR scope on `v2-core` touches only journal, mission, analysis, risk, execution, trades, learning, reports, and five UI pages unless stability review completed.

---

## Kill switch

- Operator may activate kill switch from Settings (server-side state + journal event).
- When active: analysis may run, but execute is blocked; blockers show in mission snapshot.
- Kill switch is not a substitute for live lock — both apply independently.

---

## Preview expiry

- Previews expire after TTL (default 15 minutes).
- Expired previews cannot execute; gate returns “Preview expired.”
- UI should show expiry time on pending preview.

---

## Duplicate order guard

- A `previewId` may produce at most one successful `ORDER_EXECUTED`.
- Re-submitting the same preview is blocked and journaled as `EXECUTE_BLOCKED`.

---

## decisionLogId required for execute

- Every preview must link to the `decisionLogId` from the analysis that created the verdict.
- Execute without linked `decisionLogId` is blocked — prevents orphan orders untraceable to a decision.

---

## Error handling

- Failures worth auditing append `ERROR_RECORDED` to journal where appropriate.
- API errors return clear messages; UI shows error state with retry — not infinite loading.
- Trading failures do not corrupt derived state; they add events or return without fake success.

---

## Compliance checklist (for PRs on v2-core)

Before merging implementation work:

- [ ] Live trading remains impossible on this branch
- [ ] Execute/close require double confirm in gate
- [ ] No new auto-execute path introduced
- [ ] No secrets in client code
- [ ] No duplicate mission/trade state store added
- [ ] Blocked execute disables UI and journals `EXECUTE_BLOCKED` when applicable
- [ ] Close uses reduce-only
- [ ] Change scope matches core loop modules only (or stability review done)

---

## What v1 did wrong (lessons, not patterns to copy)

- Multiple sources of truth (UI state + snapshot builders + reconcile backfill)
- Execute modals that could appear enabled while blockers active
- Advanced modules added before testnet loop was stable
- Feature-sprawl pages that duplicated mission/trade views

v2 safety rules exist to prevent repeating these failures.

---

## Core engine safety integration

- `appendCoreEventStrict` rejects live environment and secret payloads
- Guard chain facade: `src/lib/core/guards/*`
- Core health `BLOCKED` should block execute/close (Phase 7 integration)
- MiroFish/collaboration boundary tests in `src/lib/core-engine.test.ts`

See [CORE_ENGINE_UPGRADE_DESIGN.md](./CORE_ENGINE_UPGRADE_DESIGN.md) § Safety rules.

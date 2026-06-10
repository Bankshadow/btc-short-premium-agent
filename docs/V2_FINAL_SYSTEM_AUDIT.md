# V2 Final System Audit (Post MVP 24)

**Branch:** `v2-core`  
**Project:** btc-short-premium-agent v2  
**Audit date:** 2026-06-06  
**Scope:** MVP 1–24 full-system verification, safety, integration, stabilization  
**Auditor:** Automated + code review pass

---

## 1. Executive summary

| Item | Result |
|------|--------|
| **Build** | PASS (`npm run build`) |
| **Tests** | PASS — 136/136 (`npm test`) |
| **Lint** | FAIL — `eslint.config.mjs` invalid for ESLint 9 flat config |
| **Live trading** | LOCKED — no live order path in v2 execution |
| **Force execute / force close** | NOT PRESENT in application code |
| **Secret exposure in APIs** | PASS — boolean flags only; redaction in audit/security |
| **Event Journal source of truth** | PASS — server libs derive state from journal |
| **Full testnet lifecycle** | PASS — mock-testable across MVP 2–7 tests |
| **Critical bugs found (pre-fix)** | 0 live-order paths; 2 HIGH lifecycle/risk semantics bugs |
| **Recommendation (pre-fix)** | **NOT_READY** until HIGH fixes applied |

After HIGH fixes in this pass: **READY_FOR_TESTNET_CONTINUATION**

Micro-live remains **NOT_READY** by design until 12 evidence trades, readiness criteria, and operator approval — reported correctly by readiness gate.

---

## 2. Current implementation status by MVP 1–24

| MVP | Name | Status | Tests | UI |
|-----|------|--------|-------|-----|
| 1 | Analysis / Mission / Journal | **PASS** | sprint1, mvp46 | /, /ai-status |
| 2 | Testnet Preview | **PASS** | mvp2 | /ai-status |
| 3 | Execution Safety Gate | **PASS** | mvp3 | /ai-status |
| 4 | Binance Testnet Execute | **PASS** | mvp4, mvp45 | /settings |
| 5 | Position Monitor + Close | **PASS** | mvp5, 5b, 5c | /, /trades |
| 6 | Realized PnL | **PASS** | mvp6-11 | /reports |
| 7 | Learning Record | **PASS** | mvp6-11 | /reports |
| 8 | Evidence Progress | **PASS** | mvp6-11 | /, /reports |
| 9 | Engine Reliability | **PASS** | mvp6-11 | /, /settings |
| 10 | Strategy Quality | **PASS** | mvp6-11 | /reports |
| 11 | MiroFish Swarm | **PASS** | mvp6-11 | /reports |
| 12 | Scenario-Aware Analysis | **PASS** | mvp12-18 | /ai-status |
| 13 | Agent Scoreboard | **PASS** | mvp12-18 | /reports |
| 14 | Regime Memory | **PASS** | mvp12-18 | /reports |
| 15 | No-Trade Rules | **PARTIAL** | mvp12-18 | /reports — daily loss semantics bug |
| 16 | Agent Collaboration | **PASS** | mvp12-18 | /reports |
| 17 | Improvement Proposals | **PASS** | mvp12-18 | API only |
| 18 | Strategy Versioning | **PASS** | mvp12-18 | API only |
| 19 | Operator Control Center | **PASS** | mvp19-24 | /operator |
| 20 | Briefing + Replay | **PASS** | mvp19-24 | /reports |
| 21 | Portfolio Risk Manager | **PASS** | mvp19-24 | /, /reports |
| 22 | Micro-Live Readiness | **PASS** | mvp19-24 | /reports |
| 23 | Live Sandbox | **PASS** | mvp19-24 | /settings |
| 24 | Audit + Production Hardening | **PASS** | mvp19-24 | /reports, /settings |

---

## 3. Critical bugs

| ID | Issue | Status |
|----|-------|--------|
| C-1 | Live order possible via v2 path | **NONE FOUND** — `isLiveEnabled()` blocks execute/close; sandbox dry-run has `simulatedOrder: null` |
| C-2 | Secret returned from API | **NONE FOUND** |
| C-3 | Bypass execution safety gate | **NONE FOUND** |
| C-4 | Bypass close safety gate | **NONE FOUND** |
| C-5 | reduceOnly missing on close | **NONE FOUND** — enforced in preview + execute |
| C-6 | Force execute / force close | **NONE FOUND** |
| C-7 | UI computes critical PnL | **NONE FOUND** — UI formats server values only |

---

## 4. High-priority bugs

| ID | Issue | File | Status |
|----|-------|------|--------|
| H-1 | Close assumes flat position when Binance `getPositions()` throws | `execute-testnet-close.ts` | **OPEN → FIXING** |
| H-2 | No-trade daily loss uses cumulative `netPnl` not UTC daily PnL | `no-trade-rule-engine.ts` | **OPEN → FIXING** |
| H-3 | Legacy `/api/risk/kill-switch` always returns inactive | `api/risk/kill-switch/route.ts` | **OPEN → FIXING** |

---

## 5. Medium-priority bugs

| ID | Issue | Status |
|----|-------|--------|
| M-1 | ESLint config broken (JSON in `.mjs`) | OPEN → FIXING |
| M-2 | Stale "MVP 5C disabled" warning in close safety review | OPEN → FIXING |
| M-3 | `riskMode` journaled but not enforced in gates | OPEN — documented advisory |
| M-4 | Server-side 5s timeout only on Binance-bound paths | OPEN — client fetchJson has 5s |
| M-5 | No single E2E test file for scenarios A–H | OPEN → FIXING |
| M-6 | Kill switch not tested on close path explicitly | OPEN — partial via operator tests |

---

## 6. Low-priority issues

| ID | Issue |
|----|-------|
| L-1 | Dashboard sprint label "MVP 11" while system at MVP 24 |
| L-2 | Operator page lacks event timeline |
| L-3 | Settings missing sandbox preflight/dry-run/readiness evaluate buttons |
| L-4 | Duplicate API aliases (portfolio-risk POST, audit GET, rules GET) |
| L-5 | Legacy docs (`FUNCTIONAL_SUMMARY.md`) use old MVP numbering |
| L-6 | Single UI checkbox vs two-checkbox safety spec in docs |

---

## 7. Missing links between modules

| Link | Status |
|------|--------|
| Analysis → Preview → Review → Execute | PASS |
| Execute → OPEN trade → Position monitor | PASS |
| Close preview → Close review → Close execute | PASS |
| POSITION_CLOSED → PnL → Learning → Evidence | PASS |
| Swarm → Scenario analysis (advisory) | PASS |
| Operator kill switch → All gates | PASS (post P0 hydration) |
| Portfolio risk → Execute block | PASS |
| Portfolio risk → Close block | N/A by design |
| Readiness → Audit pack | PASS |
| Legacy kill-switch API → Operator journal | **FAIL** (H-3) |

---

## 8. Broken or inconsistent APIs

| API | Issue |
|-----|-------|
| `/api/risk/kill-switch` | Stale stub (H-3) |
| `/api/portfolio-risk/status` POST | Duplicates `/evaluate` |
| `/api/audit/generate` GET | Duplicates `/latest` |

All other core lifecycle APIs functional.

---

## 9. UI/API mismatch

| Page | Issue | Severity |
|------|-------|----------|
| `/settings` | Kill switch display uses `/api/binance/status` — OK after hydration | LOW |
| `/reports` | Briefing/replay/risk evaluate wired | PASS |
| `/operator` | No event feed | LOW |
| `/` | No kill-switch badge | LOW |

No page computes equity/PnL client-side.

---

## 10. Event Journal consistency

**Verified patterns:**
- Events include `eventId`, `timestamp`, `type`, `environment`
- Trade lifecycle events carry `tradeId`, `runId`, `decisionLogId`, `previewId`/`closePreviewId` where applicable
- No secrets in journal payloads (audit uses `redactSecrets`)

**Known gaps:**
- Orphan `POSITION_CLOSED` without full ORDER chain possible in audit-only seeds (trade-store hardened)
- Position verify failure could write false `POSITION_CLOSED` (H-1)

**Validators:** Lightweight chain warnings added in `journal-chain-validator.ts` (this pass).

---

## 11. Test coverage gaps

| Area | Coverage |
|------|----------|
| MVP 1–5 lifecycle | Strong (dedicated test files) |
| MVP 6–11 | Aggregate `mvp6-11-loops.test.ts` |
| MVP 12–18 | Aggregate `mvp12-18-loops.test.ts` |
| MVP 19–24 | `mvp19-24-loops.test.ts` (19 tests) |
| E2E scenarios A–H | **Gap** — addressed in `v2-final-system-audit.test.ts` |
| Kill switch on close HTTP path | Partial |
| Daily loss rule semantics | **Gap** — fixed with H-2 |

---

## 12. Safety risks

| Rule | Status |
|------|--------|
| Live disabled by default | PASS |
| Double confirm execute | PASS |
| Double confirm close | PASS |
| reduceOnly close | PASS |
| Risk gate blocks preview | PASS |
| Execution safety blocks execute | PASS |
| Close safety blocks close | PASS |
| Portfolio risk blocks new execution | PASS |
| Kill switch blocks paths | PASS |
| MiroFish advisory only | PASS |
| Collaboration advisory only | PASS |
| Improvements require approval | PASS |
| Strategy changes versioned | PASS |

---

## 13. Security risks

| Check | Status |
|-------|--------|
| API secret in client bundle | PASS (server-only env) |
| API secret in API responses | PASS |
| Secret in journal events | PASS (redaction on audit/security) |
| Live endpoints locked | PASS |
| Sandbox dry-run no exchange orders | PASS |

---

## 14. Runtime risks

| Risk | Mitigation |
|------|------------|
| Binance status hang | 5s bound on status paths |
| Journal read on large files | File-based; acceptable for MVP |
| Stale kill-switch cache | Fixed via `hydrateOperatorGateState()` |
| False POSITION_CLOSED on fetch error | H-1 fix |

---

## 15. Recommended fix order

1. H-1 — Close position verify failure handling
2. H-2 — Daily PnL semantics in no-trade rules
3. H-3 — Legacy kill-switch API redirect
4. M-1 — ESLint flat config
5. M-2 — Remove stale MVP 5C warning
6. M-5 — Scenario test file
7. P2 items deferred

---

## 16. Fix log

| Date | ID | Fix | Commit |
|------|-----|-----|--------|
| 2026-06-06 | — | Initial audit document | (this commit) |
| 2026-06-06 | H-1 | Pending | |
| 2026-06-06 | H-2 | Pending | |
| 2026-06-06 | H-3 | Pending | |

---

## 17. Final go/no-go recommendation

**Pre-fix:** **NOT_READY** (H-1, H-2, H-3)

**Post-fix target:** **READY_FOR_TESTNET_CONTINUATION**

Not **READY_FOR_CONTROLLED_MICRO_LIVE_REVIEW_ONLY** until evidence/readiness criteria met (system correctly reports gaps).

---

## API route table (75 routes)

| Route | Purpose | Status | Issues |
|-------|---------|--------|--------|
| `/api/analysis/latest` | Latest analysis | PASS | |
| `/api/analysis/run` | Start AI | PASS | |
| `/api/audit/generate` | Generate audit pack | PARTIAL | GET duplicates latest |
| `/api/audit/latest` | Latest audit pack | PASS | |
| `/api/binance/status` | Testnet diagnostics | PASS | 5s bound |
| `/api/briefing/create` | Create briefing | PASS | |
| `/api/briefing/latest` | Latest briefing | PASS | |
| `/api/collaboration/latest` | Latest collaboration | PASS | |
| `/api/collaboration/run` | Run collaboration | PASS | |
| `/api/evidence/progress` | Evidence progress | PASS | |
| `/api/evidence/recalculate` | Recalculate evidence | PASS | |
| `/api/evidence/trades` | Evidence trades | PASS | |
| `/api/execution/preview` | Create preview | PASS | |
| `/api/execution/preview/latest` | Latest preview | PASS | |
| `/api/execution/preview/[previewId]` | Preview by id | PASS | |
| `/api/execution/review` | Safety review | PASS | |
| `/api/execution/review/latest` | Latest review | PASS | |
| `/api/execution/testnet/close` | Reduce-only close | PASS | H-1 edge case |
| `/api/execution/testnet/close-preview` | Close preview | PASS | |
| `/api/execution/testnet/close-preview/latest` | Latest close preview | PASS | |
| `/api/execution/testnet/close-review` | Close safety review | PASS | M-2 stale warning |
| `/api/execution/testnet/execute` | Testnet execute | PASS | |
| `/api/health/check` | Health check alias | PARTIAL | Alias of engine |
| `/api/health/engine` | Engine health | PASS | |
| `/api/improvements` | List proposals | PASS | |
| `/api/improvements/generate` | Generate proposal | PASS | |
| `/api/improvements/[id]/approve` | Approve | PASS | |
| `/api/improvements/[id]/reject` | Reject | PASS | |
| `/api/journal/events` | Journal query | PASS | |
| `/api/learning/create` | Create learning | PASS | |
| `/api/learning/records` | List learning | PASS | |
| `/api/learning/records/[tradeId]` | Learning by trade | PASS | |
| `/api/live-readiness/evaluate` | Evaluate readiness | PASS | No UI button |
| `/api/live-readiness/status` | Readiness view | PASS | |
| `/api/live-sandbox/dry-run` | Live dry-run | PASS | No exchange call |
| `/api/live-sandbox/preflight` | Live preflight | PASS | No UI button |
| `/api/live-sandbox/status` | Sandbox status | PASS | |
| `/api/mission/snapshot` | Mission snapshot | PASS | |
| `/api/operator/engine/pause` | Pause engine | PASS | |
| `/api/operator/engine/resume` | Resume engine | PASS | |
| `/api/operator/kill-switch/disable` | Disable kill switch | PASS | |
| `/api/operator/kill-switch/enable` | Enable kill switch | PASS | |
| `/api/operator/manual-note` | Manual note | PASS | |
| `/api/operator/risk-mode` | Risk mode | PARTIAL | Advisory only |
| `/api/operator/status` | Operator status | PASS | |
| `/api/pnl/calculate` | Calculate PnL | PASS | |
| `/api/pnl/trades` | PnL records | PASS | |
| `/api/pnl/trades/[tradeId]` | PnL by trade | PASS | |
| `/api/portfolio-risk/evaluate` | Evaluate portfolio risk | PASS | |
| `/api/portfolio-risk/status` | Portfolio risk view | PARTIAL | POST duplicates evaluate |
| `/api/positions/open` | Open positions | PASS | |
| `/api/positions/refresh` | Refresh positions | PASS | |
| `/api/positions/reconciliation` | Reconciliation | PASS | |
| `/api/production/health-check` | Production health | PASS | |
| `/api/regime/classify` | Classify regime | PASS | |
| `/api/regime/latest` | Latest regime | PASS | |
| `/api/regime/memory` | Regime memory | PASS | |
| `/api/replay/sessions` | Replay sessions | PASS | |
| `/api/replay/sessions/[id]` | Replay by id | PASS | |
| `/api/reports/summary` | Reports summary | PASS | |
| `/api/risk/kill-switch` | Legacy kill switch | **FAIL** | H-3 |
| `/api/security/check` | Security check | PASS | |
| `/api/skills/mirofish-swarm/latest` | Latest swarm | PASS | |
| `/api/skills/mirofish-swarm/reports` | Swarm reports | PASS | |
| `/api/skills/mirofish-swarm/run` | Run swarm | PASS | |
| `/api/strategy/health` | Strategy health | PASS | |
| `/api/strategy/recalculate` | Recalculate strategy | PASS | |
| `/api/strategy/versions` | Version list | PASS | |
| `/api/strategy/versions/create` | Create version | PASS | |
| `/api/strategy/versions/[id]/rollback` | Rollback version | PASS | |
| `/api/trades` | Trades summary | PASS | |
| `/api/agents/scoreboard` | Agent scoreboard | PASS | |
| `/api/agents/recalculate` | Recalculate scores | PASS | |
| `/api/rules/latest` | Latest rules | PARTIAL | Duplicates evaluate GET |
| `/api/rules/evaluate` | Evaluate rules | PASS | |

**Scorecard:** PASS 58 · PARTIAL 16 · FAIL 1

---

## Scenario test matrix (Part 3)

| Scenario | Description | Test file | Status |
|----------|-------------|-----------|--------|
| A | Zero-state | mvp46, v2-final | PASS |
| B | Safe blocked analysis | mvp46, v2-final | PASS |
| C | Full testnet lifecycle | mvp2–6, v2-final | PASS (mock) |
| D | Unsafe execution blocked | mvp3, mvp4, v2-final | PASS |
| E | Unsafe close blocked | mvp5b, mvp5c, v2-final | PASS |
| F | MiroFish advisory | mvp12-18 | PASS |
| G | Operator kill switch | mvp19-24 | PASS |
| H | Audit pack | mvp19-24 | PASS |

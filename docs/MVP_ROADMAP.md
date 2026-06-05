# Trading Desk MVP Roadmap

Analysis-only desk — no live exchange execution unless explicitly scoped in a future MVP.

## Completed

| MVP | Focus |
|-----|--------|
| 1–2 | Playbook engine + TradingAgents-style bull/bear, strategies, risk, committee |
| 3 | Decision log, paper outcomes, reflection, scoreboard, draft rules |
| 4 | Desk memory (journal → agents, advisory only) |
| 5 | Research layer (market data, regime, data quality, macro, ETH/BTC) |
| 6 | Portfolio milestones, session replay, journal Supabase sync, cron desk briefing |
| 9 | Operator hub: alerts, risk profile, narrator, backtest, desk APIs, webhooks |
| 10 | Profit validation, capital allocation v2, regime router, kill switch (`/validation`) |
| 11 | Semi-live trade control — order ticket, human approval gate, execution modes |
| 12 | Capital scaling & account loop — $1k→$20k stages, split engine, scale rules (`/capital`) |
| 13 | Strategy skill registry — promote/demote, committee gates (`/strategies`) |
| 14 | Safety, governance, incident review, hard rule lock (`/governance`, `/incidents`) |
| 15 | Trading OS productization — workspace, modes, API docs, reports, public view |
| 16 | AI Strategy Council — multi-agent debate, proposals, council memo (`/council`) |
| 17 | Data trust & strategy conflict control — provenance, freshness, conflict gate |
| 18 | Pre-mortem, loss autopsy, regret tracker (`/mortem`) |
| 19 | Capital & rule simulation (`/simulation`) |
| 20 | Operator discipline & war room (`/war-room`) |
| 21 | Multi-asset perp directional scanner — BTC/SOL/WLD/LINK/DOGE, paper-first (`/assets`) |
| 32 | Exchange read-only connector — Bybit wallet, positions, open orders (`/governance`) |
| 33 | Order preview & validation — dry-run Bybit payload, margin check (`/api/exchange/preview`) |
| 34 | Live perp gate + AI desk automation orchestrator (`/automation`, `/api/desk/automation/run`) |

---

## MVP 34 — Live Perp Gate & AI Desk Automation ✅

**Goal:** (A) First live perp path with human double-confirm; (B) wire all ops nav modules into one auto cycle that produces actions, not dead pages.

### Delivered — Live (MVP 34A)

1. **`bybitPrivatePost`** + **`place-linear-order.ts`**
2. **`live-execution-gate.ts`** — `LIVE_EXECUTION_ENABLED`, confirm token, frequency governor
3. **`POST /api/exchange/execute`** — perp market order after preview
4. **UI** — Execute live on `/assets` preview panel (double confirm checkbox)

### Delivered — Automation (MVP 34B)

1. **`run-desk-automation.ts`** — runs 11 modules: analyze, assets, council, mortem, simulation, war_room, capital, validation, frequency, exchange, operator
2. **`derive-automation-actions.ts`** — OPEN_PAPER_PERP, REVIEW_BTC_TRADE, COUNCIL_PROPOSAL, LOWER_RISK, etc.
3. **`apply-automation-client.ts`** — auto paper open, pause paper, optional safe mode
4. **`POST /api/desk/automation/run`** + **`GET /api/cron/desk-automation`**
5. **`/automation`** UI + **`useDeskAutomation`** hook on main dashboard (15m cycle)
6. Top bar **AI** link

### Env

| Variable | Purpose |
|----------|---------|
| `LIVE_EXECUTION_ENABLED` | `true` to allow `/api/exchange/execute` |
| `LIVE_REQUIRE_DOUBLE_CONFIRM` | default true |
| `CRON_SECRET` | cron + execute confirm token signing |

### Guardrails

- No auto-live — execute requires UI double confirm + valid preview token
- Council/strategy changes remain human-approved
- Cron automation runs server-side (empty journal unless client POSTs entries)

---

## MVP 33 — Order Preview & Validation ✅

**Goal:** Validate what would be sent to Bybit before any live execution (MVP 34). No orders placed.

### Delivered

1. **`instrument-info.ts`** — lot size / min notional from Bybit public API
2. **`instrument-mapper.ts`** — perp signal → linear market order; option ticket → limit sell
3. **`order-validator.ts`** — qty, notional, `LIVE_MAX_NOTIONAL_USD`, `LIVE_ALLOWED_SYMBOLS`, balance check
4. **`order-preview.ts`** — orchestrator with wallet read from MVP 32
5. **`POST /api/exchange/preview`** — `{ source: "perp_signal" | "order_ticket", ... }`
6. **UI** — Preview on Trade Control + `/assets` scanner

### Env (optional limits)

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIVE_MAX_NOTIONAL_USD` | `500` | Cap preview/ future live size |
| `LIVE_ALLOWED_SYMBOLS` | all desk perps | Comma list e.g. `SOLUSDT,DOGEUSDT` |
| `LIVE_EXECUTION_ENABLED` | `false` | Master kill for future MVP 34 |

### Next

- MVP 34: Live perp execution gate (testnet, human double-confirm)

---

## MVP 32 — Exchange Read-Only Connector ✅

**Goal:** Connect to Bybit with server-side API keys for read-only account visibility. No order placement.

### Delivered

1. **`src/lib/exchange/`** — HMAC auth client, wallet, linear/option positions, open orders
2. **`GET /api/exchange/status`** — full snapshot + clock skew check
3. **`GET /api/exchange/positions`** — positions-only poll
4. **Governance UI** — Exchange panel on `/governance`

### Env

| Variable | Purpose |
|----------|---------|
| `BYBIT_API_KEY` | Server only — never expose to client |
| `BYBIT_API_SECRET` | Server only |
| `BYBIT_TESTNET` | `true` for testnet (recommended first) |

### Guardrails

- Read-only connector — no trading endpoints
- API key should have Read permission only (no withdraw)
- Next: MVP 33 order preview, MVP 34 live perp gate

---

## MVP 21 — Multi-Asset Perp Directional Desk ✅

**Goal:** Extend beyond BTC options to a perp directional read across BTC · SOL · WLD · LINK · DOGE, and make paper positions open automatically from actionable signals. Still **analysis-only / paper-first** — no live exchange execution.

### Delivered

1. **Asset config** (`src/lib/multi-asset/asset-config.ts`) — 5 USDT perps; WLD/LINK/DOGE flagged perp-only (no options market).
2. **Perp directional agent** (`perp-directional-agent.ts`) — trend (EMA stack + MACD), RSI, ATR, funding → conviction score (-100..+100) → LONG/SHORT/FLAT with HIGH/MED/LOW confidence, suggested size, ATR-based SL/TP.
3. **Scanner** (`multi-asset-scanner.ts`) — fetches ticker + D/4H klines per asset (`src/lib/bybit/perp-market.ts`, generic `getLinearKlines`), ranks by conviction.
4. **Perp paper store** (`perp-paper-store.ts`) — auto-opens simulated positions from actionable signals, mark-to-market, manual close, portfolio summary. localStorage, no live order.
5. **`/assets`** UI + `GET|POST /api/multi-asset/scan`.

### Guardrails

- No live orders, no exchange auth — paper positions are simulated only.
- Signals below conviction threshold or with stale/insufficient data are non-actionable (no auto-open).
- Independent of BTC options gates; the heavy data-trust/pre-mortem gates still protect the BTC options pipeline.

---

## MVP 20 — War Room & Operator Discipline ✅

**Goal:** Operator analytics, crisis drills, emergency playbook, trade frequency governor.

### Delivered

1. **Operator behavior analytics** + discipline score
2. **10 preset scenario drills** + emergency playbook actions
3. **Trade frequency governor** with cooldowns
4. **`/war-room`** UI + APIs `POST /api/war-room/run-scenario`, `POST /api/operator/discipline`, `POST /api/frequency/check`

---

## MVP 19 — Simulation ✅

**Goal:** Monte Carlo capital risk, milestone projection, drawdown stress, rule impact on log.

### Delivered

1. **`src/lib/simulation/`** + **`src/lib/rules/rule-impact-simulator.ts`**
2. **`POST /api/simulation/capital-risk`** + **`POST /api/simulation/rule-impact`**
3. **`/simulation`** dashboard — advisory only, no auto risk/rule changes

---

## MVP 18 — Pre-Mortem, Loss Autopsy & Regret ✅

**Goal:** Learn from failure before TRADE and after losses — no auto live rules.

### Delivered

1. **Pre-mortem agent** — PASS / CAUTION / BLOCK before order ticket
2. **Loss autopsy** — on resolved losses; draft rule + incident candidate
3. **Regret tracker** — false TRADE / false SKIP metrics
4. **Outcome classifier** — 8 resolution classes
5. **Decision log fields** — preMortem, autopsy, regret flags, lesson tags
6. **UI `/mortem`** + dashboard pre-mortem panel before trade control

---

## MVP 17 — Data Trust & Conflict Control ✅

**Goal:** Reliability layer before committee TRADE — data provenance, freshness, agent conflict gate.

### Delivered

1. **`src/lib/data-trust/`** — provenance, freshness rules, confidence score (0–100)
2. **`src/lib/conflict/`** — disagreement score, strategy conflict detector, conflict gate
3. **`POST /api/analyze`** — `dataTrust`, `dataProvenance`, `conflictAnalysis`, `conflictGate`, `finalVerdict`
4. **Dashboard** — Data Trust Score, source map, warnings, conflict meter, trade gate banner
5. **Guardrails** — CRITICAL/LOW data trust and HIGH/CRITICAL conflict block TRADE; risk veto respected

---

## MVP 16 — AI Strategy Council ✅

**Goal:** Self-improving desk council — agents debate $1k→$20k pace with risk control; no auto live trading.

### Delivered

1. **Six council agents** — goal, performance, optimizer, risk critic, capital allocator, moderator
2. **POST /api/council/run** — full session response schema
3. **UI `/council`** — debate, proposals, risk review, memo, proposal status board
4. **Guardrails** — DRAFT proposals, hard rules locked, human approval only

### API

- `POST /api/council/run` — pass `entries`, `orders`, `topic`, equity params from client

---

## MVP 15 — Trading OS Productization ✅

**Goal:** Reusable AI Trading Desk OS — workspace profiles, environment modes, API contract, exports.

### Delivered

1. **Workspace / desk config** — 4 profiles (`/workspace`)
2. **Environment modes** — DEMO, PAPER, SEMI_LIVE, SAFE_MODE with wired effects
3. **API contract** — `/api-docs` for core desk APIs
4. **Report export** — daily, weekly, scoreboard, incidents (`/reports`)
5. **Public vs private** — `/summary` public · private operator tools on `/`

### API

- `GET /api/trading-os` — product metadata

---

## MVP 14 — Safety, Governance & Incident Review ✅

**Goal:** Governance and safety controls for semi-live operations — no auto live trading.

### Delivered

1. **User roles placeholder** — Viewer, Operator, Risk Manager, Admin (local audit attribution)
2. **Operator override log** — timestamp, verdicts, veto, reason, operator, outcome
3. **Kill switch panel** — pause analysis, paper auto-open, aggressive, alerts, safe mode
4. **Incident review** — `/incidents` with full incident schema + status workflow
5. **Hard rule lock** — stale data, daily loss, data quality, missing risk data (non-overridable)
6. **Safe mode** — forces committee TRADE → WAIT/SKIP; logged to governance audit

### API

- `GET /api/governance` — roles, hard rules, kill switch actions

---

## MVP 13 — Strategy Skill Registry ✅

**Goal:** Registry for trading strategies/skills — scored, promoted, or disabled; gates committee and tickets.

### Delivered

1. **Strategy schema** — id, version, product type, regimes, risk, metrics, draft rule links
2. **Registry UI** — `/strategies` list + detail, promote/demote/disable, link draft rules
3. **Version history** — placeholder log on status changes
4. **Committee integration** — DISABLED/DEPRECATED agents cannot propose TRADE; payload on analyze
5. **Trade tickets** — PAPER_TESTING / DRAFT / WATCHLIST block semi-live order tickets

### API

- `GET /api/strategies` — seeds and gate rules

---

## MVP 12 — Capital Scaling & Account Loop ✅

**Goal:** Capital stage manager for the $1k → $20k mission — planning and simulation only.

### Delivered

1. **Portfolio milestone tracker** — stages 1k → 2k → 4k → 8k → 16k → 20k+
2. **Capital split engine** — protected reserve, core, growth, experimental (rebalance on 2× stage floor)
3. **Scale permission rules** — sample size, avg R, drawdown, operator overrides, data quality
4. **Capital dashboard** — `/capital` with stage, milestone, split, allocation, scale gate, ruin warning

### API

- `GET /api/capital` — mission ladder + scale rule thresholds

---

## MVP 11 — Semi-Live Trade Control ✅

**Goal:** Human-approved trade layer — no automatic live exchange orders.

### Delivered

1. **Order ticket** on committee TRADE (strategy, SL, TP, size, invalidation, reasons)
2. **Approval gate** — Approve / Reject / Modify / Paper only + operator notes → decision log
3. **Pre-trade checklist** — data quality, veto, loss limits, size, macro, kill switch
4. **Execution modes** — `COPY_ONLY`, `PAPER_EXECUTE`, `MANUAL_APPROVED_LIVE_PLACEHOLDER`
5. Auto paper on TRADE **disabled** when human approval required

---

## MVP 10 — Profit Validation & Capital Control ✅

**Goal:** Measure which agents/strategies have edge — no new trading features.

### Delivered

1. **Strategy Performance Matrix** — 6 buckets, full metrics, ACTIVE/WATCHLIST/PAPER_ONLY/DISABLED/EXPERIMENTAL
2. **Agent promotion/demotion engine** — threshold rules on signals, avg R, drawdown
3. **Regime-based strategy router** — static rules + regime performance table
4. **Capital allocation v2** — reserve/core/growth/experimental %, aggressive allowed flag
5. **Kill switch & cooldown** — daily/weekly loss, drawdown, streak, data quality, aggressive lockout, operator pause
6. **Validation dashboard** — `/validation`

### API

- `GET /api/validation` — thresholds + regime router rules

---

## MVP 9 — Operator Hub & Desk Signals ✅

**Goal:** Operations layer — alerts, external signals, narrator, and rule backtest without live execution.

### Delivered

1. **Alert routing** — verdict templates; cron quiet hours 22:00–08:00 BKK; TRADE/veto full briefing
2. **Risk profile** — `balanced` | `aggressive` (UI + `deskRiskProfile` on analyze)
3. **Operator override** — audit-only disagree + reason → decision log
4. **Desk APIs** — `GET /api/desk/status`, `GET /api/desk/health`, `POST /api/alerts/test`
5. **Webhooks** — `DESK_WEBHOOK_URL` on TRADE/analyze; optional `DISCORD_WEBHOOK_URL`
6. **LLM narrator** — `OPENAI_API_KEY` optional; template fallback (Thai default)
7. **Rule backtest** — client replay of last N logs vs current rules

### Env (MVP 9)

| Variable | Purpose |
|----------|---------|
| `DESK_RISK_PROFILE` | Server default `balanced` \| `aggressive` |
| `DESK_WEBHOOK_URL` | POST JSON on cron analyze |
| `DISCORD_WEBHOOK_URL` | Optional Discord on cron |
| `DESK_ALERT_QUIET_HOURS` | Set `false` to disable BKK quiet hours |
| `OPENAI_API_KEY` | Optional desk narrator |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |

---

## MVP 7 — Operator Control & Alerting

**Goal:** Human-in-the-loop controls without breaking analysis-only guardrails.

### Scope

1. **Alert routing**
   - Telegram templates per verdict (TRADE / SKIP / WAIT / veto)
   - Optional Discord webhook
   - Quiet hours (Bangkok TZ) — no ping overnight unless veto

2. **Desk presets**
   - Save/load macro + override presets (JSON local + optional Supabase `desk_presets`)
   - Quick switch: “FOMC week”, “Normal day”, “Post-cascade”

3. **Manual committee override (logged)**
   - Operator marks “I disagree” with reason → stored in decision log
   - Does **not** change engine veto; audit trail only

4. **Health dashboard**
   - Bybit fetch success rate, last cron, last Supabase sync, paper open count

### Deliverables

- `src/lib/alerts/` — routing + templates
- `src/app/api/alerts/test/route.ts`
- UI: **Operator panel** in Operations accordion

### Success criteria

- Cron + manual test send correct template
- Preset restores macro/overrides in one click
- Override notes appear in replay + journal sync

---

## MVP 8 — Intelligence Upgrade (LLM + Backtest)

**Goal:** Optional LLM narration on top of deterministic desk; offline backtest of rules.

### Scope

1. **LLM narrator (optional, env-gated)**
   - After committee: 3–5 sentence Thai/EN desk note from structured JSON only
   - Never changes verdict; `OPENAI_API_KEY` or compatible API on server only
   - Fallback: template text if LLM off

2. **Rule backtest / replay engine**
   - Replay N past `analysis_runs` or local logs through **current** no-trade rules
   - Report: “would SKIP now” delta %

3. **Agent calibration report**
   - Monthly PDF/markdown: scoreboard + milestone + regime breakdown
   - Export from Supabase + local merge

4. **ETH/BTC regime module v2**
   - Rolling correlation window (7d) when historical series available (CoinGlass / stored runs)

### Deliverables

- `src/lib/llm/desk-narrator.ts` (server-only)
- `src/lib/backtest/replay-rules.ts`
- UI: **Backtest** tab + export button

### Success criteria

- LLM off → desk unchanged
- Backtest runs on 10+ stored runs without timeout on Vercel (background job or client-only for small N)

---

## Suggested order after MVP 6

```
MVP 9 (operator hub)  →  MVP 7 (presets polish)  →  MVP 8 (deep LLM/backtest)
```

MVP 9 ships core pieces of MVP 7–8; remaining 7–8 scope is presets UI, calibration export, ETH correlation v2.

Supabase migrations to plan for MVP 7–8:

- `004_desk_presets.sql`
- `005_operator_overrides.sql`
- `006_alert_delivery_log.sql` (optional)

---

## Environment checklist (all MVPs)

| Variable | Used for |
|----------|----------|
| `SUPABASE_URL` | analysis_runs, paper_orders, decision_log_entries |
| `SUPABASE_SERVICE_ROLE_KEY` | server sync only |
| `CRON_SECRET` | Vercel cron + test automation |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | briefing alerts |
| `OPENAI_API_KEY` (MVP 8) | optional narrator |
| `BYBIT_API_KEY` / `BYBIT_API_SECRET` (MVP 32) | read-only exchange connector |
| `BYBIT_TESTNET` (MVP 32) | `true` for testnet wallet/positions |

Run SQL in order: `001` → `002` → `003` in [supabase/migrations](../supabase/migrations/).

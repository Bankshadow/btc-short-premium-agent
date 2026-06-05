# Functional Summary — BTC Short Premium Agent

> **Generated:** June 2026  
> **Purpose:** Complete inventory of current features, APIs, agents, data flows, and gaps for MVP planning.  
> **Constraint:** Documentation only — no application logic changes.

---

## 1. Project Overview

### What this app currently does

**btc-short-premium-agent** is a Next.js 16 trading desk that combines:

1. A **6-step BTC options short-premium playbook engine** (market snapshot → 8-check framework → no-trade rules → combination read → verdict → action plan).
2. A **TradingAgents-style multi-agent desk** (research, bull/bear thesis, spot/futures/options strategies, risk manager, investment committee).
3. **Paper trading** for BTC options and **separate perp paper** for BTC/SOL/WLD/LINK/DOGE directional signals.
4. **Operator tooling** — decision log, reflection, scoreboard, draft rules, desk memory, governance, council, simulation, war room, capital/validation dashboards.
5. **Optional live perp execution** (MVP 34) behind env gates, preview tokens, and UI double-confirm.
6. **AI desk automation** (MVP 34B) that orchestrates all ops modules on a 15-minute cycle.

### Main purpose

Help an operator decide whether to run a **BTC short-call / premium-selling** options trade (and related perp directional trades) using structured rules, multi-agent debate, and layered risk gates — with journaling, paper outcomes, and optional alerts.

### Current operating mode

| Mode | Status |
|------|--------|
| **Analysis-only** | Default for BTC options pipeline; heavy gates (data trust, conflict, pre-mortem, governance) often block TRADE |
| **Paper trading** | BTC options paper (`paper-orders`) + perp paper (`perp-paper-positions`); auto-open when committee TRADE and settings allow |
| **Alerts** | Cron `/api/cron/analyze` → Telegram, Discord, desk webhook; test via `/api/alerts/test` |
| **Semi-live trade control** | Order ticket + human approval gate on main dashboard (MVP 11) |
| **Live perp** | Opt-in via `LIVE_EXECUTION_ENABLED=true`; requires preview confirm token + double confirm (MVP 34) |
| **No auto-live** | Council/strategy/registry changes are human-approved; automation never places live orders |

**Production URL:** `https://btc-short-premium-agent.vercel.app/`

---

## 2. Main Features

### Dashboard (`/`)

- Live Bybit market fetch with client-side fallback when server fetch fails
- **Analyze Now** + auto-refresh timer (`useAutoDeskRefresh`)
- 6-step playbook panels, agent pipeline animation, data trust / conflict meters
- Committee verdict, debate table, agent scoreboard
- Decision log sidebar, paper orders panel, trade control (semi-live ticket)
- Pre-mortem panel, backtest/replay panels (client-side on log)
- Portfolio snapshot, operator narrator (OpenAI optional)
- Desk automation hook (`useDeskAutomation`) — 15m client cycle when dashboard open
- Mock fallback in DEMO mode only when Bybit fails

### Playbook Engine

- `runDecisionEngine` — 6 deterministic steps from `DecisionEngineInput`
- No-trade rules (`evaluateNoTradeRules`), thresholds (IV/HV, SD distance, liquidation, macro)
- Combination read for short-call candidate selection
- Verdict + action plan (instrument, size %, entry notes)
- Derivatives overrides and macro event inputs from client/localStorage

### Multi-Agent Desk

- Research layer → desk memory → bull/bear → spot/futures/options → risk manager → committee
- Strategy registry gates agent recommendations (promote/demote)
- Governance overlay on committee verdict (pause, hard rules, kill switch)
- Reliability layer (MVP 17): data provenance, confidence score, conflict gate → `finalVerdict`
- Pre-mortem layer (MVP 18): PASS / CAUTION / BLOCK before trade control

### Paper Trading

**BTC options paper** (`src/lib/paper/`)

- Auto-open on TRADE when `autoOpenOnTrade` enabled and no human-approval required
- Auto-close all open orders on SKIP/WAIT flip
- PnL engine, Supabase sync (`/api/paper/sync`)
- Linked to decision log via `decisionLogId`

**Perp paper** (`src/lib/multi-asset/perp-paper-store.ts`)

- Auto-open from actionable perp signals (conviction ≥ 35)
- Mark-to-market, manual close, portfolio summary
- Separate localStorage key; not unified with BTC options paper

### Decision Log

- Append on each analysis (`saveFromAnalysis`)
- Outcome resolution, reflection agent, replay snapshot
- Pre-mortem, autopsy, regret fields (MVP 18)
- Agent scoreboard derived from resolved entries
- Supabase sync (`/api/journal/sync`)

### Reflection

- `reflection-agent.ts` runs on outcome resolution
- Structured reflection → optional draft rule creation
- Lesson tags, regret metrics feed mortem dashboard

### Agent Scoreboard

- Win rate / alignment stats per agent from decision log
- Displayed on main dashboard

### Draft Rules

- Created from reflection or mortem autopsy
- Stored in localStorage; fed into desk memory on analyze
- Rule impact simulation via `/api/simulation/rule-impact`

### Desk Memory

- `memory-agent.ts` — summarizes journal, draft rules, pinned notes
- Advisory only; bullets appear in committee top reasons
- Pinned notes CRUD in localStorage

### Research Layer

- Market Data, Regime, Data Quality, Macro & News agents
- ETH/BTC correlation overlay
- Data quality score (0–100) gates committee in balanced mode

### Risk Profile

- **Balanced** vs **Aggressive** (`desk-settings`, env `DESK_RISK_PROFILE`)
- Affects IV/HV floors, SD floors, missing-field veto count, committee alignment rules
- Aggressive can align committee to playbook TRADE for paper execution

### Alerts / Webhooks

- **Cron analyze** (daily midnight UTC): Telegram, Discord, `DESK_WEBHOOK_URL`
- **Desk webhook** payload: `desk.analyze` or `desk.trade` events
- **Test alerts** `/api/alerts/test` (test mode only)
- Quiet hours via `DESK_ALERT_QUIET_HOURS`

### Cron Automation

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/analyze` | `0 0 * * *` (daily) | Full analyze + journal + alerts + Supabase |
| `/api/cron/desk-automation` | `*/15 * * * *` | 11-module automation cycle |

Auth: `CRON_SECRET` header or `?test=1` with `ALLOW_TEST_AUTOMATION`

### Backtest / Replay

- **Backtest** (`backtest/replay-rules.ts`) — replays draft/hard rules against decision log (client panel)
- **Replay** (`replay/build-replay-snapshot.ts`) — snapshot stored per log entry for session replay panel
- No server-side historical market replay API

### Desk APIs

- `/api/desk/status` — integration index (metadata)
- `/api/desk/health` — health check + Supabase open paper count
- `/api/trading-os` — product metadata (profiles, modes, pages)

### MVP 17–20 (implemented)

| MVP | Feature | Route / lib |
|-----|---------|-------------|
| 17 | Data trust, provenance, conflict gate | `data-trust/`, `conflict/` |
| 18 | Pre-mortem, loss autopsy, regret | `mortem/`, `/mortem` |
| 19 | Capital risk + rule impact simulation | `simulation/`, `/simulation` |
| 20 | War room drills, operator discipline, frequency governor | `war-room/`, `operator/`, `/war-room` |

### MVP 21, 32–34 (implemented)

| MVP | Feature |
|-----|---------|
| 21 | Multi-asset perp scanner + perp paper (`/assets`) |
| 32 | Bybit read-only exchange connector (`/governance`) |
| 33 | Order preview & validation (`/api/exchange/preview`) |
| 34 | Live perp gate + AI desk automation (`/automation`) |

### Also implemented (MVPs 10–16)

- Validation dashboard + kill switch (`/validation`)
- Capital scaling mission (`/capital`)
- Strategy registry (`/strategies`)
- Governance + incidents (`/governance`, `/incidents`)
- Trading OS workspace, reports, API docs, public summary
- AI Strategy Council (`/council`)

---

## 3. API Endpoints

| Endpoint | Method | Purpose | Input | Output | Main files | Status |
|----------|--------|---------|-------|--------|------------|--------|
| `/api/analyze` | POST | Main BTC options + agent pipeline | Partial/full `DecisionEngineInput`, deskMemory, ethQuote, governance, strategyRegistry, deskRiskProfile | `AnalyzeApiResponse` (+ dataTrust, conflictGate, finalVerdict, preMortem) | `decision/run-analyze.ts`, `decision/analyze.ts`, `agents/run-trading-desk.ts` | **Working** |
| `/api/market` | GET | Live BTC market snapshot | — | Market JSON | `bybit/`, `app/api/market/route.ts` | **Working** |
| `/api/cron/analyze` | GET/POST | Scheduled/manual analyze + alerts | `?test=1`, `Authorization: Bearer CRON_SECRET` | Cron response + flags (telegram, webhook, supabase) | `cron/analyze/route.ts` | **Working** (needs env) |
| `/api/cron/desk-automation` | GET | 15m automation cycle | Cron auth | `DeskAutomationResult` | `automation/run-desk-automation.ts` | **Working** (server journal empty unless POST) |
| `/api/desk/automation/run` | GET/POST | Run automation modules | POST: `{ entries?, orders?, riskProfile?, modules?, topic? }` | Full automation result + actions | `automation/` | **Working** |
| `/api/multi-asset/scan` | GET/POST | Perp directional scan | POST: `{ symbols? }` | Ranked signals per asset | `multi-asset/multi-asset-scanner.ts` | **Working** |
| `/api/exchange/status` | GET | Exchange connectivity + live gate flags | — | Wallet, positions, orders, `liveExecution` | `exchange/build-exchange-status.ts` | **Working** (needs API keys) |
| `/api/exchange/positions` | GET | Positions poll only | — | Positions payload | `exchange/positions.ts` | **Working** — **no UI consumer** |
| `/api/exchange/preview` | POST | Dry-run order validation | `{ source: "perp_signal"\|"order_ticket", signal\|ticket }` | Preview ticket + confirm token | `exchange/order-preview.ts` | **Working** |
| `/api/exchange/execute` | POST | Live perp market order | `{ signal, confirmToken, confirmExpiresAt, doubleConfirm }` | Execute result | `exchange/place-linear-order.ts`, `live-execution-gate.ts` | **Partial** — gated off by default |
| `/api/council/run` | POST | AI strategy council session | `{ topic?, currentEquity?, entries?, orders?, riskProfile? }` | Council session + proposals | `council/run-council-session.ts` | **Working** |
| `/api/simulation/capital-risk` | POST | Monte Carlo / milestone sim | Sim params + `{ entries?, orders? }` | capitalRisk, milestone, drawdown | `simulation/capital-risk-simulator.ts` | **Working** (advisory) |
| `/api/simulation/rule-impact` | POST | Draft rule impact on log | `{ rule, entries?, orders? }` | Impact sim | `rules/rule-impact-simulator.ts` | **Working** (advisory) |
| `/api/war-room/run-scenario` | POST | Crisis drill | `{ scenarioId, entries? }` | Drill result | `war-room/scenario-drill-engine.ts` | **Working** (advisory) |
| `/api/operator/discipline` | GET/POST | Operator behavior score | POST: `{ entries?, overrideLog? }` | Discipline report | `operator/operator-discipline-score.ts` | **Working** |
| `/api/frequency/check` | POST | Trade frequency governor | `{ entries?, conflict? }` | Frequency advisory | `frequency/trade-frequency-governor.ts` | **Working** (advisory) |
| `/api/governance` | GET | Governance schema metadata | — | Roles, hard rules, kill-switch actions | `governance/` | **Metadata** — client builds state locally |
| `/api/strategies` | GET | Strategy registry seeds | — | Registry seeds + gate rules | `strategy-registry/` | **Metadata** — client builds registry |
| `/api/capital` | GET | Capital mission metadata | — | Ladder + thresholds | `capital/` | **Metadata** — client builds report |
| `/api/validation` | GET | Validation thresholds | — | Thresholds + regime router rules | `validation/` | **Metadata** — client builds report |
| `/api/desk/status` | GET | Desk monitor index | — | Integrations, risk profile, API index | `desk/api-contract.ts` | **Metadata** — **unused at runtime** |
| `/api/desk/health` | GET | Health check | — | `{ ok, health }` | `operator/desk-health.ts` | **Working** |
| `/api/trading-os` | GET | Product metadata | — | Profiles, modes, pages | `trading-os/` | **Metadata** — **unused at runtime** |
| `/api/paper/orders` | GET | List paper orders | `?status=open` | Orders list | `paper/paper-sync.ts` | **Working** (lib consumer) |
| `/api/paper/sync` | GET/POST | Supabase paper sync | POST: `{ orders[] }` | Sync result | `supabase/paper-orders.ts` | **Working** (optional Supabase) |
| `/api/journal/sync` | GET/POST | Supabase decision log sync | POST: `{ entries[] }` | Sync result | `supabase/decision-log-sync.ts` | **Working** (optional Supabase) |
| `/api/alerts/test` | POST | Test Telegram/Discord alert | `{ discordWebhookUrl? }` | Send result | `mock/dashboard-data.ts` | **Working** (test mode) |
| `/api/admin/automation-status` | GET | Admin env flags | — | test/cron/telegram configured | — | **Working** |
| `/api/notify` | POST | Legacy analyze + Telegram | — | verdict + telegram id | `decision/analyze.ts` | **Legacy** — **no consumer** |

---

## 4. Agent System

### Core trading desk agents (BTC options pipeline)

| Agent | File | Role | Input | Output | Verdict impact | Veto |
|-------|------|------|-------|--------|----------------|------|
| **Market Data** | `agents/market-data-agent.ts` | Tape summary, combination context | `TradingDeskContext` (market, candidates, technicals) | `AgentOutput` (RECOMMENDATION, reasons) | Research brief → committee context | No |
| **Regime** | `agents/regime-agent.ts` | Market structure label | Context + resolved regime | `AgentOutput` | Labels `marketRegime` | No |
| **Data Quality** | `agents/data-quality-agent.ts` | Completeness gate | Missing fields, source errors | `AgentOutput` + score | Committee WAIT if score < threshold | No |
| **Macro & News** | `agents/macro-news-agent.ts` | Calendar / macro overlay | macroEvent, macroView | `AgentOutput` | Context for strategies | No |
| **Desk Memory** | `memory/memory-agent.ts` | Journal + rules recall | Client memory payload | `DeskMemorySnapshot` + agent | Top reasons in committee | No |
| **Bull Thesis** | `agents/bull-thesis-agent.ts` | Risk-on advocate | Market + technicals | `AgentOutput` | Can support TRADE | No |
| **Bear Thesis** | `agents/bear-thesis-agent.ts` | Risk-off advocate | Market + liquidation | `AgentOutput` | SKIP pushes committee to WAIT/SKIP | No |
| **Spot Strategy** | `agents/spot-agent.ts` | Cash & carry view | Context | `AgentOutput` | 1 of 3 strategy votes | No |
| **Futures Strategy** | `agents/futures-agent.ts` | Perp & basis view | Funding, OI | `AgentOutput` | 1 of 3 strategy votes | No |
| **Options Strategy** | `agents/options-agent.ts` | Vol & premium view | IV/HV, candidates | `AgentOutput` | Majority vote driver; balanced mode can block TRADE | No |
| **Risk Manager** | `agents/risk-manager-agent.ts` | Hard veto gate | No-trade rules, missing data, IV/HV, SD, losses | `AgentOutput` + `veto` | **Veto → committee SKIP** | **Yes** |
| **Investment Committee** | `agents/committee-agent.ts` | Final verdict synthesis | All agents + research + memory | `CommitteeVerdict` + debate | Sets `finalVerdict`, `riskVeto` | Inherits risk veto |

**Output format (all desk agents):** `AgentOutput` — `recommendation: TRADE|SKIP|WAIT`, `confidence: HIGH|MEDIUM|LOW`, `reasons[]`, `risks[]`, `proposedAction`, `missingData[]`, optional `veto`/`vetoReasons`.

### Post-committee layers (not in agent roster UI)

| Component | File | Role | Impact |
|-----------|------|------|--------|
| **Reliability / Data Trust** | `data-trust/apply-reliability-layer.ts` | Provenance + confidence + conflict gate | Can downgrade TRADE → WAIT/SKIP via `finalVerdict` |
| **Pre-Mortem** | `mortem/pre-mortem-agent.ts` | Failure scenarios before ticket | PASS / CAUTION / BLOCK on trade control |
| **Reflection** | `agents/reflection-agent.ts` | Post-outcome learning | Draft rules; no verdict impact |

### Council agents (separate session — `/council`)

| Agent | File | Role |
|-------|------|------|
| Goal Strategist | `council/goal-strategist-agent.ts` | $1k→$20k pace framing |
| Performance Analyst | `council/performance-analyst-agent.ts` | Log/stats review |
| Capital Allocator | `council/capital-allocator-agent.ts` | Split recommendations |
| Risk Critic | `council/risk-critic-agent.ts` | Challenge proposals |
| Strategy Optimizer | `council/strategy-optimizer-agent.ts` | Registry tuning ideas |
| Committee Moderator | `council/committee-moderator-agent.ts` | Session synthesis |

Council output: proposals and memo — **human approval required**; does not auto-change registry.

### Multi-asset perp agent

| Agent | File | Role | Output |
|-------|------|------|--------|
| **Perp Directional** | `multi-asset/perp-directional-agent.ts` | EMA/MACD/RSI/ATR/funding → conviction | `PerpDirectionalSignal` (LONG/SHORT/FLAT, size, SL/TP) |

Independent of BTC options committee; actionable if `|conviction| ≥ 35`.

### Mortem agents

| Agent | File | Role |
|-------|------|------|
| **Pre-Mortem** | `mortem/pre-mortem-agent.ts` | Pre-trade failure analysis |
| **Loss Autopsy** | `mortem/loss-autopsy-agent.ts` | Post-loss review → draft rule / incident |

---

## 5. Decision Flow

### A. User opens dashboard (`/`)

```
Browser loads AnalyzeDashboard
  → hydrate decision log, paper orders, desk settings from localStorage
  → optional pull from Supabase (journal + paper if sync enabled)
  → useDeskAutomation starts 15m timer (if enabled in automation settings)
  → useAutoDeskRefresh may schedule analyze based on desk settings
  → render last cached analysis state (if any) or empty state
```

### B. User clicks **Analyze Now**

```
1. Check governance.pauseAnalysis → abort if paused
2. Load client context:
   - decision log, draft rules, pinned notes → deskMemory payload
   - desk settings (risk profile), strategy registry, governance state
   - derivatives overrides, macro event defaults
   - ETH quote (optional fetch)
3. POST /api/analyze with client context
4. If server-side Bybit fails → fetch live input in browser → POST again with full engine input
5. If still no live data → error; DEMO mode may use getMockDashboardFallback()
6. persistAnalysis(result):
   - setData(result)
   - saveFromAnalysis → decision log entry + replay snapshot
   - paper.afterAnalysis → auto open/close paper orders
   - syncJournalIfEnabled → POST /api/journal/sync
```

### C. `/api/analyze` runs

```
POST body → runAnalyzeRequest()
  → applyDeskRiskProfile(deskRiskProfile)
  → if full engine input: runDecisionEngineFromInput()
     else: runAnalysisEngine()
        → buildEngineInput() [Bybit market, options, klines]
        → runDecisionEngine() [6 playbook steps]
        → attachTradingDesk()
           → runResearchLayer()
           → runDeskMemoryAgent()
           → bull/bear/spot/futures/options agents
           → runRiskManagerAgent()
           → runCommitteeAgent()
           → applyGovernanceToVerdict()
        → applyReliabilityLayerToAnalyzeResponse() [MVP 17]
        → applyPreMortemToAnalyzeResponse() [MVP 18]
  → return AnalyzeApiResponse JSON
```

### D. Agents run (order)

See §4 and `desk/agent-roster.ts` pipeline order: Research (4) → Memory → Bull/Bear → Spot/Futures/Options → Risk → Committee.

### E. Risk Manager evaluates

```
evaluateNoTradeRules() + desk risk profile thresholds
  → missing data count vs riskMissingFieldVetoCount()
  → IV/HV vs riskIvHvFloor(), SD vs riskSdFloor()
  → consecutive losses vs riskConsecutiveLossVeto()
  → liquidation/macro/technical gates
  → if veto: recommendation SKIP, veto=true, vetoReasons[]
```

### F. Investment Committee decides

```
Majority of spot/futures/options recommendations
  → if riskVeto: finalVerdict = SKIP
  → else apply bear/data-quality/missing-data/balanced-mode rules
  → aggressive profile may align to playbook TRADE
  → applyGovernanceToVerdict() (pause, hard rules, kill switch)
```

### G. Reliability layer (post-committee)

```
buildDataProvenance → computeDataConfidence
detectStrategyConflicts → applyConflictGate
  → may set conflictGate.tradeBlocked
  → alignPlaybookVerdictWithGate → finalVerdict on response
```

### H. Paper order is created (client-side)

```
paper.afterAnalysis(data, decisionLogId):
  → tryAutoClosePaperOnSkip() if verdict SKIP/WAIT
  → tryAutoOpenPaperOrder() if TRADE, no veto, autoOpen enabled, no human approval required
  → buildPaperOrderFromAnalysis() maps action plan → PaperOrder
  → save to localStorage (PAPER_ORDERS_STORAGE_KEY)
  → optional syncPaperToServer()
```

**Perp paper** (separate, on `/assets` or automation): `perp-paper-store` opens from scan signals.

### I. Decision log is saved

```
saveFromAnalysis(data):
  → new DecisionLogEntry with agent outputs, verdict, replay snapshot
  → append to localStorage (DECISION_LOG_STORAGE_KEY)
  → attachTradeControlToEntry if semi-live ticket active
```

### J. Alerts are sent

**Manual analyze:** No automatic alert on dashboard analyze (unless separately configured).

**Cron analyze (`/api/cron/analyze`):**
```
runAnalyzeRequest → appendServerAnalysisFromResponse
  → saveAnalysisRunToSupabase (if configured)
  → formatRoutedCronMessage → sendTelegramMessage
  → postDeskWebhook (DESK_WEBHOOK_URL)
  → sendDiscordWebhook (if configured)
```

**Automation:** Does not send alerts directly; may derive actions for client apply.

---

## 6. Data Sources

| Source | Used for | Freshness / fallback |
|--------|----------|----------------------|
| **Bybit public API** | BTC spot, options chain, linear perps, klines, funding | Primary; client-side fallback if Vercel server fetch fails |
| **Bybit private API** | Wallet, positions, open orders, live execute (MVP 32–34) | Requires `BYBIT_API_KEY` / `BYBIT_API_SECRET`; testnet via `BYBIT_TESTNET` |
| **localStorage** | All persistent desk state (log, paper, settings, governance) | Browser-only; source of truth unless Supabase sync on |
| **Supabase** | Optional cloud backup: `analysis_runs`, `paper_orders`, `decision_log_entries` | Pull on hydrate if sync enabled; push after save |
| **Manual / defaults** | Derivatives overrides, macro event, desk risk profile, pinned notes | `DEFAULT_DERIVATIVES_OVERRIDES`, `DEFAULT_MACRO_EVENT_STATUS` in dashboard |
| **Environment variables** | Risk profile default, cron overrides, live gates, alerts | See §3 and env table below |
| **Mock data** | `getMockDashboardFallback()`, `DEFAULT_LIQUIDATION` (source: mock) | DEMO mode only for full fallback; production flags mock in data provenance |
| **OpenAI** | Desk narrator (`OPENAI_API_KEY`) | Optional; fails gracefully |
| **Cron config overrides** | `CRON_LIQUIDATION_24H`, `CRON_OI_*`, etc. | Injects into cron analyze input |

### Stale / missing data handling

- `DataSourceError[]` collected during fetch; surfaced as `dataSourceIssues`
- Data Quality agent + Risk Manager count missing fields
- Data trust layer grades CRITICAL/LOW → blocks TRADE
- Perp scanner marks signals non-actionable if insufficient klines
- Bybit failure → user-visible error; mock only in DEMO

### Environment variables (server `src/lib`)

| Variable | Purpose |
|----------|---------|
| `BYBIT_API_KEY`, `BYBIT_API_SECRET`, `BYBIT_TESTNET`, `BYBIT_API_BASE_URL` | Exchange |
| `LIVE_EXECUTION_ENABLED`, `LIVE_REQUIRE_DOUBLE_CONFIRM`, `LIVE_MAX_NOTIONAL_USD`, `LIVE_ALLOWED_SYMBOLS` | Live gate |
| `CRON_SECRET`, `ALLOW_TEST_AUTOMATION` | Cron auth |
| `DESK_RISK_PROFILE` | Default balanced/aggressive |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Cloud sync |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Alerts |
| `DISCORD_WEBHOOK_URL`, `DESK_WEBHOOK_URL` | Webhooks |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Narrator |
| `DESK_ALERT_QUIET_HOURS` | Alert routing |
| `CRON_*` overrides | Cron analyze input |
| `JOURNAL_DATA_DIR` | Server journal path |
| `NODE_ENV`, `VERCEL_ENV` | Production detection for data trust |

---

## 7. Storage

### localStorage keys

| Key | Content |
|-----|---------|
| `trading-agents-crypto-desk:decision-log` | Decision log entries |
| `trading-agents-crypto-desk:paper-orders` | BTC options paper orders |
| `trading-agents-crypto-desk:paper-settings` | Paper auto-open, Supabase sync flags |
| `btc-desk:perp-paper-positions` | Perp paper positions (multi-asset) |
| `trading-agents-crypto-desk:desk-settings` | Risk profile, sync flags, refresh interval |
| `trading-agents-crypto-desk:draft-rules` | Draft rules from reflection |
| `trading-agents-crypto-desk:pinned-memory-notes` | Pinned desk memory notes |
| `trading-agents-crypto-desk:strategy-registry` | Strategy promote/demote state |
| `trading-agents-crypto-desk:governance-desk-state` | Governance settings |
| `trading-agents-crypto-desk:kill-switch-state` | Kill switch flags |
| `trading-agents-crypto-desk:governance-audit-log` | Governance audit trail |
| `trading-agents-crypto-desk:operator-override-log` | Operator overrides |
| `trading-agents-crypto-desk:desk-incidents` | Incident records |
| `trading-agents-crypto-desk:capital-mission-settings` | Capital dashboard settings |
| `trading-agents-crypto-desk:trade-control-settings` | Semi-live trade control |
| `trading-agents-crypto-desk:workspace-config` | Trading OS workspace |
| `trading-agents-crypto-desk:council-sessions` | Council session history |
| `btc-desk:automation-settings` | Automation module toggles |
| `btc-desk:automation-last-run` | Last automation result cache |
| `btc-short-premium-agent:derivatives-overrides` | Manual OI/volume/liquidation overrides |
| `btc-short-premium-agent:macro-event` | Macro event selection |

**Legacy keys migrated:** `multi-agent-trading-desk:analysis-journal`, `btc-short-premium-agent:analysis-journal`

### Supabase tables

| Table | Purpose |
|-------|---------|
| `analysis_runs` | Cron analysis history (no orders) |
| `paper_orders` | Synced paper orders from client |
| `decision_log_entries` | Synced decision log from client |

### In-memory / server ephemeral

- `desk-risk-policy.ts` — active profile per request (`applyDeskRiskProfile`)
- `journal-server-store` — server-side cron journal append
- React state in dashboards — current analysis, loading, pipeline animation
- Exchange preview confirm tokens — signed, short-lived (`execute-confirm.ts`)

---

## 8. Risk Controls

### No-trade rules (playbook + risk manager)

- IV/HV ratio floors (profile-dependent)
- SD distance floors
- Liquidation cluster proximity (`LIQUIDATION_SKIP`)
- Macro event before settlement
- Consecutive loss streak
- Prior-day rally filter
- Missing critical fields → risk veto when count exceeds threshold

### Risk veto

- Risk Manager sets `veto: true` → Committee `finalVerdict = SKIP`, `riskVeto = true`
- Propagates to paper (no auto-open), trade control block, webhook `riskVeto: true`

### Risk profiles

| Control | Balanced | Aggressive |
|---------|----------|------------|
| Min data quality for committee | 45 | 25 |
| IV/HV floor | 1.15 | 1.05 |
| SD floor | 1.5 | 1.2 |
| Missing fields for veto | 1 | 4 |
| Consecutive loss veto | 3 | 4 |
| Playbook WAIT → TRADE | No | Yes (confidence ≥ 52) |
| Options must agree for TRADE | Yes | Relaxed |

Governance can disable aggressive via `isGovernanceAggressiveDisabled()`.

### Operator override

- Trade control human approval gate (`isHumanApprovalRequired()`)
- Operator override log in governance
- Semi-live execution modes (MVP 11) — ticket requires explicit approval

### Hard rule locks

- Governance hard rules applied in `applyGovernanceToVerdict`
- Strategy registry gates demoted strategies
- Draft rules advisory via desk memory (not auto-enforced unless promoted)

### Kill switch

- `validation/kill-switch.ts` + governance state
- Can block aggressive profile, pause analysis, restrict execution modes

### Safe mode

- Trading OS `SAFE_MODE` environment blocks mock fallback
- Automation can apply `LOWER_RISK` / pause paper actions
- `pauseAnalysis` governance flag stops Analyze Now

### MVP 17 conflict gate

- HIGH/CRITICAL agent disagreement → `conflictGate.tradeBlocked`
- CRITICAL/LOW data trust → TRADE blocked

### MVP 18 pre-mortem

- BLOCK verdict prevents trade control proceed
- CAUTION shows warnings

### Live execution gates (MVP 34)

- `LIVE_EXECUTION_ENABLED` must be `true`
- Valid preview confirm token + expiry
- `LIVE_REQUIRE_DOUBLE_CONFIRM` (default true)
- `LIVE_MAX_NOTIONAL_USD`, `LIVE_ALLOWED_SYMBOLS`
- Trade frequency governor advisory on execute path

---

## 9. Current UI Pages / Components

| Route | Component | Purpose | Main data | Status |
|-------|-----------|---------|-----------|--------|
| `/` | `AnalyzeDashboard` | Main BTC desk | `/api/analyze`, `/api/market`, localStorage | **Complete** |
| `/assets` | `MultiAssetDashboard` | Perp scanner + paper + live preview | `/api/multi-asset/scan`, exchange APIs | **Complete** |
| `/automation` | `AutomationDashboard` | AI automation control + last run | `/api/desk/automation/run`, `/api/exchange/status` | **Complete** |
| `/council` | `CouncilDashboard` | AI strategy council | `/api/council/run`, council sessions | **Complete** |
| `/mortem` | `MortemDashboard` | Pre-mortem, autopsy, regret | Decision log localStorage | **Complete** |
| `/simulation` | `SimulationDashboard` | Capital + rule sims | `/api/simulation/*`, log | **Complete** (advisory) |
| `/war-room` | `WarRoomDashboard` | Drills + discipline | `/api/war-room/*`, `/api/operator/discipline` | **Complete** (advisory) |
| `/capital` | `CapitalDashboard` | $1k→$20k mission | `/api/capital` metadata + log | **Complete** (client-built) |
| `/strategies` | `StrategiesDashboard` | Strategy registry | `/api/strategies` metadata + log | **Complete** |
| `/validation` | `ValidationDashboard` | Profit validation, kill switch | `/api/validation` metadata + log | **Complete** |
| `/governance` | `GovernanceDashboard` | Roles, hard rules, exchange panel | localStorage + `/api/exchange/status` | **Complete** |
| `/incidents` | `IncidentsDashboard` | Incident review | localStorage incidents | **Complete** |
| `/workspace` | `WorkspaceDashboard` | Trading OS workspace config | workspace localStorage | **Complete** |
| `/reports` | `ReportsDashboard` | Internal reports | Decision log | **Complete** |
| `/summary` | `PublicSummaryDashboard` | Public-safe summary | Redacted log view | **Complete** |
| `/api-docs` | `ApiDocsDashboard` | API documentation | Static contract | **Complete** |

### Key dashboard subcomponents

| Component | Purpose | Status |
|-----------|---------|--------|
| `DashboardView` | Layout shell for analyze panels | Working |
| `ReplayDeskPanel` | Session replay from log snapshots | Working |
| `BacktestDeskPanel` | Rule replay on log | Working |
| `TradeControlPanel` | Semi-live order ticket + preview | Working |
| `ExchangePreviewPanel` | Order preview display | Working |
| `ExchangeStatusPanel` | Read-only exchange snapshot | Working (needs keys) |
| `useAgentPipeline` | Pipeline animation during load | Working |
| `useDecisionLog` / `usePaperTrading` | Log + paper hooks | Working |
| `useDeskAutomation` | Client automation loop | Working |

---

## 10. Known Gaps / Issues

### Architecture / duplication

- **Two paper systems** — BTC options (`paper-orders.ts`) vs perp (`perp-paper-store.ts`); different keys, no unified portfolio
- **Metadata APIs unused at runtime** — `/api/governance`, `/api/strategies`, `/api/capital`, `/api/validation`, `/api/trading-os`, `/api/desk/status` duplicate client-side builders
- **Legacy `/api/notify`** — superseded by cron analyze + alerts test; no fetch consumer

### Mock / stale data

- `DEFAULT_LIQUIDATION` uses `source: "mock"` when live liquidation unavailable
- Full dashboard mock fallback only in DEMO; still risks confusion if env misconfigured
- Derivatives overrides default to static values in `AnalyzeDashboard` (not loaded from localStorage on analyze)

### Missing connections

- `/api/exchange/positions` — no UI poll (status endpoint includes positions)
- Server cron automation runs with **empty journal** unless client POSTs entries/orders
- Alerts **not fired** on manual dashboard analyze — only cron path
- Council proposals don't auto-apply to strategy registry

### Incomplete features

- **BTC options live execution** — not implemented (planned MVP 36); only perp live path exists
- **Unified paper loop** (MVP 22) — not built
- **BTC paper unlock / PAPER_RELAXED** (MVP 23) — not built
- **Supabase as source of truth** — sync is optional push/pull; localStorage remains primary
- **Backtest** — client-side log replay only; no historical market backtest

### Error handling gaps

- Automation modules swallow errors per-module (returns `ok: false`) but UI may show partial success
- Exchange errors surface generically; clock skew warning easy to miss
- Vercel hobby plan may not run 15m cron reliably — client hook is fallback when tab open

### Technical debt / risk

- Aggressive profile can force committee TRADE aligned to playbook — intentional but risky if governance not configured
- Confirm token signing uses `CRON_SECRET` — shared secret across cron and execute
- localStorage-only state — lost on browser clear; multi-device not supported without Supabase
- `macroView` hardcoded `bearish` on home page (`page.tsx`)
- Inconsistent storage key prefix (`btc-short-premium-agent:` vs `trading-agents-crypto-desk:` vs `btc-desk:`)

### Unused / low-traffic files

- `api/notify/route.ts` — legacy
- Server journal (`journal-server-store`) — parallel to Supabase/localStorage without UI viewer

---

## 11. MVP Mapping

| MVP | Scope | Implementation status |
|-----|-------|----------------------|
| **MVP 1** | Playbook engine (6 steps) | ✅ Complete |
| **MVP 2** | Multi-agent desk (bull/bear, strategies, risk, committee) | ✅ Complete |
| **MVP 3** | Decision log, paper, reflection, scoreboard, draft rules | ✅ Complete |
| **MVP 4** | Desk memory | ✅ Complete |
| **MVP 5** | Research layer | ✅ Complete |
| **MVP 6** | Portfolio milestones, replay, journal Supabase sync, cron briefing | ✅ Complete |
| **MVP 9** | Operator hub: alerts, risk profile, narrator, backtest, desk APIs, webhooks | ✅ Complete |
| **MVP 10** | Validation, kill switch | ✅ Complete (`/validation`) |
| **MVP 11** | Semi-live trade control | ✅ Complete (human approval gate) |
| **MVP 12** | Capital scaling | ✅ Complete (`/capital`) |
| **MVP 13** | Strategy registry | ✅ Complete (`/strategies`) |
| **MVP 14** | Governance + incidents | ✅ Complete |
| **MVP 15** | Trading OS productization | ✅ Complete |
| **MVP 16** | AI Strategy Council | ✅ Complete (`/council`) |
| **MVP 17** | Data trust + conflict gate | ✅ Complete |
| **MVP 18** | Pre-mortem, autopsy, regret | ✅ Complete (`/mortem`) |
| **MVP 19** | Simulation | ✅ Complete (`/simulation`) |
| **MVP 20** | War room + operator discipline | ✅ Complete (`/war-room`) |
| **MVP 21** | Multi-asset perp desk | ✅ Complete (`/assets`) |
| **MVP 22** | Unified paper loop + perp journal | ❌ Not started |
| **MVP 23** | BTC paper unlock (PAPER_RELAXED) | ❌ Not started |
| **MVP 24–31** | Strategy adaptation, regime router v2, unified capital, etc. | ❌ Not started (per roadmap) |
| **MVP 32** | Exchange read-only | ✅ Complete |
| **MVP 33** | Order preview | ✅ Complete |
| **MVP 34** | Live perp gate + automation | ✅ Complete |
| **MVP 36** | BTC options live | ❌ Planned |

**MVP 7–8:** Not listed in roadmap as discrete shipped MVPs; capabilities partially absorbed into MVPs 9–15 (webhooks, desk APIs, operator tooling).

---

## 12. Recommended Next Steps

### Fix first (stability + trust)

1. **Wire derivatives overrides from localStorage** into analyze request (currently defaults only).
2. **Unify paper portfolio view** — single dashboard showing BTC options + perp paper PnL (MVP 22 starter).
3. **Server automation journal** — POST log/orders to `/api/desk/automation/run` from cron hook or Supabase pull so server cron is useful headless.
4. **Document/env-gate production** — ensure `LIVE_EXECUTION_ENABLED` false in prod; verify `CRON_SECRET`, Bybit keys on Vercel.
5. **Manual analyze alerts** — optional webhook/Telegram on TRADE+veto for dashboard runs.

### Remove or deprecate

1. **`/api/notify`** — mark deprecated in api-docs; remove when confirmed unused.
2. **Duplicate metadata API fetches** — either wire UI to GET endpoints or remove endpoints and keep client-only builders.
3. **Legacy journal storage keys** — migration already exists; remove after one release.

### Refactor

1. **Storage key namespace** — consolidate to single `btc-desk:` prefix.
2. **Paper store abstraction** — shared interface for options + perp paper (open/close/sync).
3. **Risk profile source of truth** — single sync between env, desk settings, and governance aggressive disable.
4. **Extract analyze client payload builder** — shared between dashboard and automation.

### Build next (MVP priority)

| Priority | MVP | Rationale |
|----------|-----|-----------|
| P0 | **MVP 22** — Unified paper loop | Operator sees one PnL story; automation can manage both books |
| P1 | **MVP 23** — BTC paper unlock mode | Desk currently over-gated for learning; relaxed mode for paper only |
| P2 | **MVP 24** — Strategy adaptation from log | Close the loop from reflection/council to registry |
| P3 | **MVP 36** — BTC options live (testnet) | After perp live proven; needs options instrument mapper |
| P4 | Supabase v2 sync | Multi-device + server automation with real journal |

### Quick wins

- Surface `/api/exchange/positions` on governance or assets page
- Load `macroView` from desk settings instead of hardcoded `bearish`
- Add "last automation action applied" toast on main dashboard
- Vercel Pro verification for 15m cron or document client-only automation

---

## Appendix: High-Level Architecture

```mermaid
flowchart TB
  subgraph Client
    UI[AnalyzeDashboard / Assets / Automation]
    LS[(localStorage)]
    UI --> LS
  end

  subgraph APIs
    A1[/api/analyze]
    A2[/api/multi-asset/scan]
    A3[/api/exchange/*]
    A4[/api/cron/*]
  end

  subgraph Engine
    PB[Playbook 6-step]
    TD[Trading Desk Agents]
    DT[Data Trust + Conflict]
    PM[Pre-Mortem]
    PB --> TD --> DT --> PM
  end

  subgraph External
    BY[Bybit API]
    SB[(Supabase)]
    TG[Telegram / Webhooks]
  end

  UI --> A1 & A2 & A3
  A1 --> Engine
  A1 --> BY
  A2 --> BY
  A3 --> BY
  UI --> SB
  A4 --> Engine
  A4 --> TG
  A4 --> SB
```

---

*End of functional summary. For roadmap detail see `docs/MVP_ROADMAP.md`. For Thai overview see `docs/DESK_OVERVIEW_TH.md`.*

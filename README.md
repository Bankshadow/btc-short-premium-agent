# BTC Short Premium Agent

## Branches

| Branch | Purpose |
|--------|---------|
| **`main`** | v1 prototype — reference only, do not extend |
| **`v2-core`** | Clean v2 foundation — **Sprint 0–1 active** |

See [docs/BRANCH_STRATEGY.md](docs/BRANCH_STRATEGY.md) · [docs/V2_ROADMAP.md](docs/V2_ROADMAP.md)

---

## v2-core — Sprint 0–1 (current)

Foundation: documentation, Event Journal, Mission Snapshot, Analysis mock.

**No Binance connectivity. No order execution.**

### Docs (Sprint 0)

- [docs/V2_ARCHITECTURE.md](docs/V2_ARCHITECTURE.md)
- [docs/V2_EVENT_MODEL.md](docs/V2_EVENT_MODEL.md)
- [docs/V2_SAFETY_RULES.md](docs/V2_SAFETY_RULES.md)
- [docs/V2_ROADMAP.md](docs/V2_ROADMAP.md)

### Modules (Sprint 1)

- `src/lib/journal/` — append + query (file-backed SoT)
- `src/lib/mission/` — `buildMissionSnapshot(events)`
- `src/lib/analysis/` — `runAnalysis()` mock
- `src/lib/risk/` — live locked policy + execute gate stubs

### Quick start

```bash
git checkout v2-core
cp .env.example .env.local
npm install
npm test
npm run build
npm run dev
```

Open http://localhost:3000 → **Start AI** on Dashboard.

Set `BINANCE_TESTNET_ENABLED=true` for `WAIT` verdict; without it, verdict is `BLOCKED`.

### Sprint 1 flow

1. **Start AI** → creates `runId` + `decisionLogId`
2. Journal: `ANALYSIS_STARTED` → `VERDICT_CREATED` → `MISSION_SNAPSHOT_UPDATED`
3. Dashboard / Reports read mission snapshot from journal

### APIs (Sprint 1)

| Method | Path |
|--------|------|
| POST | `/api/analysis/run` |
| GET | `/api/analysis/latest` |
| GET | `/api/journal/events` |
| GET | `/api/mission/snapshot` |

### Safety

- Live trading **locked** (`RISK_POLICY.liveLocked = true`)
- Execution routes return 403 until Sprint 2+
- No browser-side secrets

---

## main (v1 reference)

Switch to `main` for the original prototype. Do not add features there.

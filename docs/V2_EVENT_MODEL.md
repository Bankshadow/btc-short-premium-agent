# V2 Event Model

Branch: **`v2-core`**

The **Event Journal** is the single source of truth for v2. All durable application state is derived by reading and replaying journal events. Nothing else is authoritative.

Related: [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) · [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md)

---

## Principles

1. **Append-only history** — events are appended, not edited in place. Corrections are new events or explicit error records.
2. **Derive, don't duplicate** — mission snapshot, trades, reports, and AI status are projections of the journal.
3. **Linkable IDs** — `runId`, `decisionLogId`, `previewId`, and `tradeId` chain analysis through execution to close and learning.
4. **Environment scoped** — every event records `environment` so testnet and future environments never mix in queries.
5. **Auditability** — a regulator or operator can reconstruct any trade lifecycle from events alone.

---

## Event envelope (required shape)

Every journal entry must include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | `string` | yes | Unique event identifier (e.g. `evt-{timestamp}-{random}`) |
| `type` | `EventType` | yes | One of the defined event types below |
| `timestamp` | `string` (ISO 8601 UTC) | yes | When the event was recorded |
| `environment` | `"testnet"` \| `"simulation"` | yes | v2-core uses `"testnet"` only; live is not a valid v2 environment |
| `runId` | `string` | optional | Analysis run that produced or triggered this event |
| `decisionLogId` | `string` | optional | Decision log entry linking analysis → preview → execute |
| `tradeId` | `string` | optional | Trade lifecycle identifier |
| `previewId` | `string` | optional | Preview identifier for execute gate |
| `payload` | `object` | yes | Type-specific data (see per-type schemas) |

### Example envelope

```json
{
  "eventId": "evt-1717654321000-a3f9c2",
  "type": "VERDICT_CREATED",
  "timestamp": "2026-06-06T12:00:01.000Z",
  "environment": "testnet",
  "runId": "run-1717654320000-x7k2m1",
  "decisionLogId": "dl-1717654320000-p4n8q0",
  "tradeId": null,
  "previewId": null,
  "payload": {
    "verdict": "TRADE",
    "confidence": 62,
    "reasons": ["Testnet practice cycle signal"],
    "symbol": "BTCUSDT",
    "side": "SELL"
  }
}
```

---

## Initial event types

### `ANALYSIS_STARTED`

Analysis cycle began (e.g. operator clicked Start AI).

| Payload field | Type | Description |
|---------------|------|-------------|
| `trigger` | `"manual"` \| `"scheduled"` | v2-core: `"manual"` only |

**Required links:** `runId`, `decisionLogId`

---

### `VERDICT_CREATED`

Analysis produced a verdict.

| Payload field | Type | Description |
|---------------|------|-------------|
| `verdict` | `"WAIT"` \| `"TRADE"` \| `"BLOCKED"` | Outcome |
| `confidence` | `number` | 0–100 |
| `reasons` | `string[]` | Human-readable rationale |
| `symbol` | `string` | optional — e.g. `BTCUSDT` |
| `side` | `"BUY"` \| `"SELL"` | optional |

**Required links:** `runId`, `decisionLogId`

---

### `PREVIEW_CREATED`

Testnet order preview generated and linked to analysis.

| Payload field | Type | Description |
|---------------|------|-------------|
| `previewId` | `string` | Same as envelope `previewId` |
| `symbol` | `string` | |
| `side` | `"BUY"` \| `"SELL"` | |
| `notionalUsd` | `number` | |
| `estimatedQty` | `string` | |
| `expiresAt` | `string` (ISO 8601) | Preview TTL expiry |
| `markPrice` | `number` \| `null` | Mark at preview time |

**Required links:** `runId`, `decisionLogId`, `previewId`

---

### `EXECUTE_BLOCKED`

Execution was attempted or considered but blocked by risk gate.

| Payload field | Type | Description |
|---------------|------|-------------|
| `previewId` | `string` | |
| `reasons` | `string[]` | Block reasons from risk gate |

**Required links:** `previewId` (and `decisionLogId` when preview exists)

---

### `ORDER_EXECUTED`

Testnet market order was placed successfully.

| Payload field | Type | Description |
|---------------|------|-------------|
| `previewId` | `string` | |
| `symbol` | `string` | |
| `side` | `"BUY"` \| `"SELL"` | |
| `exchangeOrderId` | `string` \| `null` | Binance order id |
| `entryPrice` | `number` | |
| `quantity` | `string` | |
| `notionalUsd` | `number` | |

**Required links:** `runId`, `decisionLogId`, `previewId`, `tradeId`

---

### `POSITION_OPENED`

Position is open and tracked in the lifecycle (may follow `ORDER_EXECUTED` or consolidate open state).

| Payload field | Type | Description |
|---------------|------|-------------|
| `tradeId` | `string` | |
| `symbol` | `string` | |
| `side` | `"BUY"` \| `"SELL"` | |
| `entryPrice` | `number` | |
| `quantity` | `string` | |
| `exchangeOrderId` | `string` \| `null` | |

**Required links:** `runId`, `decisionLogId`, `tradeId`

> **Note:** If `ORDER_EXECUTED` already carries full open semantics, implementations may emit both events in sequence or derive open state from `ORDER_EXECUTED` until `POSITION_OPENED` is explicitly appended. v2 target model includes `POSITION_OPENED` as a distinct lifecycle marker.

---

### `POSITION_CLOSED`

Position closed via reduce-only on testnet.

| Payload field | Type | Description |
|---------------|------|-------------|
| `tradeId` | `string` | |
| `symbol` | `string` | |
| `side` | `"BUY"` \| `"SELL"` | Original position side |
| `exitPrice` | `number` | |
| `closeReason` | `string` | e.g. `"reduce-only"` |

**Required links:** `runId`, `decisionLogId`, `tradeId`

---

### `PNL_REALIZED`

Realized PnL calculated for a closed trade.

| Payload field | Type | Description |
|---------------|------|-------------|
| `tradeId` | `string` | |
| `grossPnl` | `number` | |
| `fee` | `number` | |
| `netPnl` | `number` | |
| `result` | `"WIN"` \| `"LOSS"` \| `"BREAKEVEN"` | |

**Required links:** `tradeId`, `decisionLogId`

---

### `LEARNING_CREATED`

Post-close learning record created.

| Payload field | Type | Description |
|---------------|------|-------------|
| `learningId` | `string` | |
| `tradeId` | `string` | |
| `symbol` | `string` | |
| `netPnl` | `number` | |
| `result` | `string` | |
| `status` | `"PENDING_REVIEW"` | v2-core initial status |

**Required links:** `runId`, `decisionLogId`, `tradeId`

---

### `MISSION_SNAPSHOT_UPDATED`

Optional audit event when a material mission projection is computed or checkpointed. **Mission views are normally derived on read**; this event is for explicit audit checkpoints, not primary storage.

| Payload field | Type | Description |
|---------------|------|-------------|
| `startCapital` | `number` | Default `1000` |
| `targetCapital` | `number` | Default `10000` |
| `currentEquity` | `number` | |
| `progressPct` | `number` | |
| `netPnl` | `number` | |
| `totalTrades` | `number` | |
| `wins` | `number` | |
| `losses` | `number` | |

**Required links:** none (projection snapshot)

---

### `ERROR_RECORDED`

Non-trade error worth persisting in the journal (API failure, unexpected gate failure, etc.).

| Payload field | Type | Description |
|---------------|------|-------------|
| `code` | `string` | Machine-readable code |
| `message` | `string` | Human-readable message |
| `context` | `object` | optional — module, route, previewId, etc. |
| `recoverable` | `boolean` | |

**Required links:** optional `runId`, `decisionLogId`, `previewId`, `tradeId` when applicable

---

## Lifecycle diagram

```
ANALYSIS_STARTED
       │
       ▼
VERDICT_CREATED ──WAIT/BLOCKED──► (end cycle)
       │
      TRADE
       │
       ▼
PREVIEW_CREATED
       │
       ├── EXECUTE_BLOCKED (gate failed)
       │
       ▼
ORDER_EXECUTED
       │
       ▼
POSITION_OPENED
       │
       ▼
POSITION_CLOSED (reduce-only)
       │
       ▼
PNL_REALIZED
       │
       ▼
LEARNING_CREATED

MISSION_SNAPSHOT_UPDATED (optional audit, any time after derived state changes)
ERROR_RECORDED (any time something fails worth journaling)
```

---

## Derivation rules (read models)

| Projection | Source events |
|------------|---------------|
| **Latest analysis** | Latest `ANALYSIS_STARTED` + `VERDICT_CREATED` by `runId` / `decisionLogId` |
| **Active preview** | Latest `PREVIEW_CREATED` not expired, not followed by `ORDER_EXECUTED` for same `previewId` |
| **Open trades** | `POSITION_OPENED` or `ORDER_EXECUTED` without matching `POSITION_CLOSED` for `tradeId` |
| **Closed trades** | `POSITION_CLOSED` + `PNL_REALIZED` per `tradeId` |
| **Realized PnL total** | Sum of `PNL_REALIZED.payload.netPnl` |
| **Learning count** | Count of `LEARNING_CREATED` |
| **Mission equity** | `startCapital` + realized PnL (+ unrealized if modeled later) |
| **Execute block history** | `EXECUTE_BLOCKED` events |

Queries must filter by `environment: "testnet"` in v2-core.

---

## Storage (implementation note)

- Default path: `data/event-journal.json` (configurable via `JOURNAL_DATA_DIR`)
- Append via single writer function; no direct file writes from UI or pages
- API route `GET /api/journal/events` exposes query; append only through domain modules

---

## ID conventions

| ID | Prefix example | Created by |
|----|----------------|------------|
| `eventId` | `evt-` | Journal append |
| `runId` | `run-` | Analysis run |
| `decisionLogId` | `dl-` | Analysis run |
| `previewId` | `prev-` | Preview creation |
| `tradeId` | `trade-` | Execute / open |
| `learningId` | `learn-` | Learning module |

Every execute and close action in a decision chain should share the same `decisionLogId` as the analysis that produced the preview.

---

## Out of scope for event model (v2-core)

- Live environment events
- Auto-execute without operator confirmation events
- Reconciliation backfill event types from v1
- Duplicate mission/trade state tables synced separately from journal

New event types require updating this document before implementation.

---

## Core event schema (Slice 1)

The core engine introduces a canonical **CoreEvent** shape for validation and future projections. Legacy journal events remain the persisted format until strict append is enabled (Slice 7).

See [CORE_ENGINE_SLICE1_EVENT_STANDARDIZATION.md](./CORE_ENGINE_SLICE1_EVENT_STANDARDIZATION.md) for full schema, rules, and examples.

### CoreEvent envelope

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | `string` | yes | Unique event identifier |
| `type` | `string` | yes | Event type (see `CoreEventTypes` in `event-types.ts`) |
| `timestamp` | ISO 8601 UTC | yes | When recorded |
| `version` | `string` | yes | Event format version (default `"1.0"`) |
| `environment` | `TESTNET` \| `PAPER` \| `LIVE_DISABLED` \| `UNKNOWN` | yes | Core environment enum |
| `source` | `SYSTEM` \| `USER` \| `AGENT` \| `EXCHANGE` \| `OPERATOR` | yes | Event origin |
| `runId` | `string` | optional | Analysis run |
| `decisionLogId` | `string` | optional | Decision chain link |
| `previewId` | `string` | optional | Execute preview |
| `tradeId` | `string` | optional | Trade lifecycle |
| `positionId` | `string` | optional | Position monitor |
| `closePreviewId` | `string` | optional | Close preview |
| `strategyVersion` | `string` | optional | Strategy version link |
| `payload` | `object` | yes | Type-specific data |
| `metadata.schemaVersion` | `string` | yes | `"core-event-v1"` |
| `metadata.createdBy` | same as `source` | yes | |
| `metadata.safeToReplay` | `boolean` | yes | Default `true` |
| `metadata.correlationId` | `string` | optional | Usually `runId` |
| `metadata.causationId` | `string` | optional | Prior `eventId` |

### Migration note

- **Persisted journal** still uses `environment: "testnet" \| "simulation"` and optional `payload.__coreMeta`.
- **Normalize:** `normalizeToCoreEvent(raw)` in `src/lib/core/event-normalizer.ts` — never throws.
- **Validate:** `validateCoreEvent(event)` or `POST /api/core/events/validate` — read-only, no store mutation.
- **Append (today):** loops still call `appendEvent()` directly; strict validated append deferred to Slice 7.

### Validator usage

```typescript
import { validateRawCoreEvent } from "@/lib/core/event-validator";

const result = validateRawCoreEvent(unknownInput);
// { valid, normalizedEvent, errors, warnings }
```

Secret leakage and live-trading flags are rejected with **CRITICAL** severity. MiroFish events must not contain execution fields (`orderId`, `avgPrice`, etc.).

---

## Core event metadata (optional extension — legacy append path)

Core engine may attach optional metadata under payload key `__coreMeta`:

| Field | Purpose |
|-------|---------|
| `createdBy` | `SYSTEM` \| `USER` \| `AGENT` \| `EXCHANGE` |
| `correlationId` | Usually `runId` |
| `causationId` | Prior `eventId` |
| `schemaVersion` | Core schema version (default 1) |
| `safeToReplay` | Replay-safe flag |

Validated via `src/lib/core/event-validator.ts`. See [CORE_ENGINE_UPGRADE_DESIGN.md](./CORE_ENGINE_UPGRADE_DESIGN.md).

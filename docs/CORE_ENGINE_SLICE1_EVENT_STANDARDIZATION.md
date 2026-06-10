# Core Engine Slice 1 — Event Standardization

Branch: **`v2-core`**  
Date: **2026-06-06**

Related: [CORE_ENGINE_ADR.md](./CORE_ENGINE_ADR.md) · [CORE_ENGINE_BLUEPRINT.md](./CORE_ENGINE_BLUEPRINT.md) · [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md) · [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md)

Slice 1 standardizes the canonical **CoreEvent** schema, adds validation and secret-leakage detection, and exposes a read-only validation API. **No trading behavior changed.** Loops still append via `journal-query.appendEvent` (permissive mode).

---

## Event schema

### CoreEvent (canonical)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventId` | `string` | yes | Unique id, e.g. `evt-*` |
| `type` | `string` | yes | One of `CoreEventTypes` or legacy journal type |
| `timestamp` | ISO 8601 UTC | yes | |
| `version` | `string` | yes | Default `"1.0"` |
| `environment` | `TESTNET` \| `PAPER` \| `LIVE_DISABLED` \| `UNKNOWN` | yes | Maps from journal `testnet` / `simulation` |
| `source` | `SYSTEM` \| `USER` \| `AGENT` \| `EXCHANGE` \| `OPERATOR` | yes | Who caused the event |
| `runId` | `string` | optional | Analysis chain |
| `decisionLogId` | `string` | optional | Analysis → preview → execute |
| `previewId` | `string` | optional | Execute gate |
| `tradeId` | `string` | optional | Trade lifecycle |
| `positionId` | `string` | optional | Monitor/close |
| `closePreviewId` | `string` | optional | Close gate |
| `strategyVersion` | `string` | optional | Strategy versioning link |
| `payload` | `Record<string, unknown>` | yes | Type-specific data |
| `metadata.schemaVersion` | `string` | yes | Default `"core-event-v1"` |
| `metadata.createdBy` | same as `source` | yes | |
| `metadata.safeToReplay` | `boolean` | yes | Default `true` |
| `metadata.correlationId` | `string` | optional | Usually `runId` |
| `metadata.causationId` | `string` | optional | Prior `eventId` |

Implementation: `src/lib/core/event-types.ts`

### Journal compatibility

Legacy journal events (`environment: "testnet"`, no `metadata` block) are normalized via `normalizeToCoreEvent()` without mutating stored records.

Optional legacy metadata remains under `payload.__coreMeta` for append adapters.

---

## Validation rules

Implemented in `src/lib/core/event-validator.ts` → `validateCoreEvent()`.

| Rule | Severity | Description |
|------|----------|-------------|
| V-001 | ERROR | `eventId` required |
| V-002 | ERROR | `type` required |
| V-003 | ERROR | `timestamp` required, valid ISO |
| V-004 | ERROR | `version` required |
| V-005 | ERROR | `environment` required |
| V-006 | ERROR | `source` required |
| V-007 | ERROR | `payload` must be plain object |
| V-008 | ERROR | `metadata.schemaVersion` required |
| V-009 | ERROR | `metadata.createdBy` required |
| V-010 | ERROR | `metadata.safeToReplay` boolean required |
| V-011 | WARNING | Trade lifecycle events should include `tradeId` |
| V-012 | WARNING | Analysis events should include `runId` |
| V-013 | WARNING | Decision events should include `decisionLogId` |
| V-014 | WARNING | Execution events should include `previewId` when applicable |
| V-015 | WARNING | Close preview events should include `closePreviewId` |
| V-016 | CRITICAL | Secret leakage (see below) |
| V-017 | ERROR | Order-like events only on `TESTNET` / `PAPER` |
| V-018 | ERROR | MiroFish events must not contain execution payload fields |
| V-019 | ERROR | Journal `environment: "live"` rejected on legacy envelope path |

**Modes:**

- **Validation API / strict path:** full `validateCoreEvent` + normalization warnings
- **Legacy append (unchanged):** `appendEvent()` — no strict gate until Slice 7
- **Legacy envelope:** `validateEventEnvelope()` for existing core-store adapter

---

## Secret leakage rules

Implemented in `src/lib/core/secret-leakage-validator.ts`.

### Forbidden keys (any depth, case-insensitive)

`apiKey`, `apiSecret`, `secret`, `signature`, `x-mbx-apikey`, `authorization`, `cookie`, `set-cookie`, `privateKey`, `passphrase`

### Suspicious patterns

- Bearer token strings
- Basic auth headers
- Binance-like 64-char hex signatures on `signature` paths
- Long opaque tokens (48+ chars) outside known id fields
- `"liveEnabled": true` or `"environment": "live"` in serialized payload/metadata
- Values matching `redactSecrets()` from security module

**Severity:** CRITICAL — event is invalid.

---

## Normalization strategy

`src/lib/core/event-normalizer.ts` → `normalizeToCoreEvent(rawEvent)`

1. Accept legacy journal shape or partial input; never throw.
2. Map `testnet` → `TESTNET`, `simulation` → `PAPER`, `live` → `LIVE_DISABLED`.
3. Infer `metadata` with defaults; emit WARNINGs for inferred fields.
4. Strip `payload.__coreMeta` into top-level `metadata` on normalized view.
5. Do **not** invent `tradeId`, `decisionLogId`, or other correlation ids.
6. `coreEventToJournalInput()` converts back for append adapters.

---

## Backward compatibility

| Concern | Approach |
|---------|----------|
| Existing journal file | Unchanged; no migration |
| `appendEvent()` in loops | Still used directly |
| `payload.__coreMeta` | Still written by `attachCoreMetadata()` |
| Legacy types (`LEARNING_CREATED`, etc.) | Accepted; listed in `LEGACY_JOURNAL_EVENT_TYPES` |
| Core health / projections | Unchanged; still use journal types |
| Lifecycle FSM | Slice 2 scope; not wired to strict append in Slice 1 |

---

## Examples

### Valid CoreEvent (analysis)

```json
{
  "eventId": "evt-1717654321000-a3f9c2",
  "type": "ANALYSIS_STARTED",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "version": "1.0",
  "environment": "TESTNET",
  "source": "USER",
  "runId": "run-1717654320000-x7k2m1",
  "decisionLogId": "dl-1717654320000-p4n8q0",
  "payload": { "trigger": "manual" },
  "metadata": {
    "schemaVersion": "core-event-v1",
    "createdBy": "USER",
    "safeToReplay": true,
    "correlationId": "run-1717654320000-x7k2m1"
  }
}
```

### Valid legacy journal event (normalizes cleanly)

```json
{
  "eventId": "evt-legacy-1",
  "type": "VERDICT_CREATED",
  "timestamp": "2026-06-06T12:00:01.000Z",
  "environment": "testnet",
  "runId": "run-legacy",
  "decisionLogId": "dl-legacy",
  "payload": { "verdict": "WAIT", "confidence": 50, "reasons": [] }
}
```

Normalization warnings: inferred `metadata.schemaVersion`, `metadata.createdBy`, `metadata.safeToReplay`.

### Invalid — secret leakage

```json
{
  "eventId": "evt-bad-1",
  "type": "ERROR_RECORDED",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "version": "1.0",
  "environment": "TESTNET",
  "source": "SYSTEM",
  "payload": { "apiSecret": "super-secret" },
  "metadata": {
    "schemaVersion": "core-event-v1",
    "createdBy": "SYSTEM",
    "safeToReplay": true
  }
}
```

Errors: `SECRET_KEY_FORBIDDEN`, `SECRET_VALUE_REDACTABLE` (CRITICAL).

### Invalid — MiroFish with execution payload

```json
{
  "type": "MIROFISH_SCENARIO_REPORT_CREATED",
  "payload": { "orderId": "12345", "avgPrice": 50000 }
}
```

Error: `MIROFISH_EXECUTION_PAYLOAD` — advisory-only boundary.

---

## API

### `POST /api/core/events/validate`

**Input:**

```json
{ "event": { } }
```

**Output:**

```json
{
  "valid": true,
  "normalizedEvent": { },
  "errors": [],
  "warnings": []
}
```

Read-only. Does not append to journal.

---

## Tests

- `src/lib/core/event-validator.test.ts` — 18 Slice 1 cases
- `src/lib/core-engine.test.ts` — legacy envelope + integration
- Full suite: **182 tests passing**

---

## Next slice recommendation

**Proceed to Slice 2:** Lifecycle state machine + invalid transition detection.

```
Implement Core Engine Migration Slice 2 only.

Read:
- docs/CORE_ENGINE_MIGRATION_PLAN.md (Slice 2)
- docs/CORE_ENGINE_BLUEPRINT.md (section 6)
- src/lib/core/lifecycle-state-machine.ts (formalize existing spike)

Goals:
1. Pure trade-scoped FSM with impossible-transition detection
2. Wire lifecycle rules into validateCoreEvent (read/strict paths only)
3. Historical journals: WARN on read; ERROR on strict append for new events only
4. Do NOT change execute/close hot paths
5. Add lifecycle-state-machine.test.ts
6. All existing tests must pass
```

---

## Slice 1 status

| Criterion | Status |
|-----------|--------|
| CoreEvent type | ✅ |
| Event validator | ✅ |
| Secret leakage validator | ✅ |
| Event normalizer | ✅ |
| Validation API | ✅ |
| Trading behavior unchanged | ✅ |
| Live trading disabled | ✅ |
| Docs updated | ✅ |

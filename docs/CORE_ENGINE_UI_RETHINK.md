# Core Engine UI Rethink — ทำไม Hotfix 1–4 แก้ไม่จบ

Date: **2026-06-06**  
Branch: **`v2-core`**

---

## สรุปสั้น

**API ถูกแล้ว แต่ UI ผิด** — ไม่ใช่เพราะ projection engine พัง แต่เพราะ **สถาปัตยกรรม UI ออกแบบผิดตั้งแต่ต้น** แล้ว Hotfix 1–4 ไปแก้ทีละจุด (unwrap, map, binding) โดยไม่แก้ root cause

Production ตอนนี้ (`/api/core/projections/bundle`):

| Field | Value |
|-------|-------|
| totalTrades | 8 |
| closed | 8 |
| evidence | 0/12 (strict — ถูกต้อง) |
| health | WARNING |
| latency | ~3.6s |

---

## Root cause ที่แท้จริง (3 ชั้น)

### 1. ไม่มี shared state — ทุกหน้า fetch ใหม่จากศูนย์

`useProjectionBundle()` ถูกเรียกแยกใน `/`, `/trades`, `/reports`, `/core`

**ผลกระทบ:**
- เปิด Dashboard → fetch 3.6s → เห็น 8 trades
- ไป `/trades` → **mount hook ใหม่** → state กลับเป็น zero → fetch ใหม่ 3.6s → เห็น 0 closed ชั่วคราว
- รู้สึกว่า "แก้แล้วแต่ยังพัง"

**แก้:** `ProjectionBundleProvider` ใน `AppShell` — fetch ครั้งเดียว แชร์ทุกหน้า

### 2. แหล่งข้อมูลแข่งกัน (dual source)

ทุกหน้ามีทั้ง:
- `useProjectionBundle()` (bundle จริง)
- `useApi(..., { fallback: getDefault*() })` (zero-state ที่มี shape ครบ)

**Bug ที่เคยเกิด:** Trades page `if (data?.summary) return data` — fallback มี `summary` เสมอ → **ชนะ bundle ทุกครั้ง**

Hotfix 4 แก้ลำดับแล้ว แต่ยังมี fallback ซ่อนอยู่

**แก้:** Trades ใช้ bundle อย่างเดียว — ลบ `useApi` สำหรับ trade list

### 3. Race / timeout ที่ 5 วินาที

- Bundle API ใช้ ~3.6s (ใกล้ timeout 5s)
- `hardStop` เคย reset state กลับ zero ขณะ fetch ยังไม่จบ
- แสดง "Projection fallback active." แม้ API จะ return ข้อมูลจริง

**แก้:** timeout 8s, ไม่ reset state ตอน timeout, แสดง fallback warning เฉพาะเมื่อ fetch ล้มเหลวจริง

---

## สิ่งที่ Hotfix 1–4 ทำถูก (เก็บไว้)

| หัวข้อ | สถานะ |
|--------|--------|
| `unwrapProjectionBundle` Cases A/B/C | ✅ |
| Strict evidence (reject PENDING_PNL) | ✅ |
| Core health จาก `/api/core/health` | ✅ |
| Binance status consistency | ✅ |
| Dashboard metric mapping | ✅ |

---

## สิ่งที่ทำใหม่ (Rethink fix)

| เปลี่ยน | ไฟล์ |
|---------|------|
| Shared `ProjectionBundleProvider` | `projection-bundle-provider.tsx`, `AppShell.tsx` |
| `bundleProjectionReady()` แก้ `closedCount ?? length` bug | `ui-projection-bind.ts` |
| `usingFallback` = `!bundleProjectionReady()` | `dashboard-projection-map.ts` |
| Trades = bundle only | `trades/page.tsx` |
| Timeout 5s → 8s | `projection-defaults.ts` |
| ไม่แสดง fallback warning ขณะ loading | `page.tsx` |

---

## สิ่งที่ยังไม่ใช่ bug (แต่ดูเหมือนพัง)

| อาการ | ความจริง |
|-------|----------|
| Evidence 0/12 | **ถูกต้อง** — 8 trades เป็น zero-fill / PENDING_PNL ถูก reject ตาม strict rules |
| Health WARNING | **ถูกต้อง** — SKIPPED_LIFECYCLE_STEP จาก journal repair |
| ไม่ถึง 12/12 evidence | ต้องมี trades ที่มี fill data จริง — ไม่ใช่แค่แก้ UI |

---

## Acceptance หลัง deploy

- [ ] เปิด `/` → เห็น 8 trades ไม่มี fallback warning (หลัง load ~4s)
- [ ] ไป `/trades` **ทันที** → ยังเห็น 8 closed (ไม่ reset เป็น 0)
- [ ] `/reports` → evidence 0/12 + rejection reasons
- [ ] `/core` → health WARNING
- [ ] Navigate ระหว่างหน้า → ไม่ fetch bundle ใหม่ทุกครั้ง (ยกเว้น Refresh)

---

## Recommendation

**`CORE_ENGINE_PARTIAL`** จนกว่า production verify UI navigation  
**`CORE_ENGINE_STABLE`** เมื่อ UI สอดคล้อง API + evidence strict + health consistent

Evidence 0/12 จะยังเป็น blocker สำหรับ MVP live — ต้อง repair journal ด้วย fill data จริง ไม่ใช่แก้ UI อีก

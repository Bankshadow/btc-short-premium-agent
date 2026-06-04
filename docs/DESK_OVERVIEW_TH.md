---
title: BTC Short Premium Agent — สรุประบบและ Flow
author: Trading Desk Documentation
date: June 2026
---

# BTC Short Premium Agent

**สรุประบบ ฟีเจอร์ทั้งหมด และ Flow การทำงาน**

| | |
|---|---|
| **โปรเจกต์** | btc-short-premium-agent |
| **Deploy** | https://btc-short-premium-agent.vercel.app/ |
| **Repo** | Bankshadow/btc-short-premium-agent |
| **หลักการ** | Analysis-only · Paper trading · Human approval |

---

## 1. หลักการสำคัญ

| หลักการ | ความหมาย |
|---------|----------|
| Analysis-only | ทุก agent / engine ให้คำแนะนำ ไม่ execute จริงบน exchange |
| Human approval | TRADE = ต้องมีมนุษย์อนุมัติก่อนเทรดจริง |
| Paper trading | จำลองออเดอร์ใน browser (+ sync Supabase ได้) |
| Risk veto | Risk Manager มีสิทธิ์ veto คณะกรรมการ |
| Memory / draft rules | แนะนำจากประวัติ — ไม่ override hard no-trade rules |

---

## 2. สรุป MVP ที่ทำแล้ว

| MVP | ฟีเจอร์หลัก |
|-----|-------------|
| **1** | Playbook engine 6 ขั้น, 8-check framework, no-trade rules, combination read |
| **2** | Bull/Bear thesis, Spot/Futures/Options, Risk Manager, Investment Committee |
| **3** | Decision log, resolve outcome, reflection, scoreboard, draft rules |
| **4** | Desk memory จาก journal + pinned notes → inject เข้า agents |
| **5** | Research: Market Data, Regime, Data Quality, Macro & News, ETH/BTC |
| **6** | Portfolio milestones, session replay, journal Supabase sync, cron briefing |
| **9** | Risk profile, alerts/webhooks, LLM narrator, operator override, desk APIs |
| **ล่าสุด** | Aggressive risk mode, paper API sync, เอา Macro/Derivatives UI ออก |

**แผนถัดไป:** MVP 7 (presets), MVP 8 (backtest ลึก, calibration export)

---

## 3. สถาปัตยกรรมระดับสูง

```
[Browser Dashboard]
    │  localStorage (log, paper, settings)
    ▼
[Next.js API] ──► /api/analyze, /api/market, /api/paper/*, /api/journal/sync
    │
    ├──► Playbook Engine (6 steps)
    ├──► Multi-Agent Desk
    └──► Desk Narrator (MVP 9)

[External]
    Bybit Public API · Supabase · Telegram · Webhooks/Discord
```

---

## 4. Flow หลัก: เปิดเว็บ → Analyze อัตโนมัติ

1. ผู้ใช้เปิดหน้า (`macroView` เริ่มต้น bearish)
2. Dashboard โหลด journal, paper, settings จาก localStorage
3. **Auto refresh** ทุก 1 / 3 / 5 นาที (ไม่ต้องกด Analyze)
4. ดึง ETH quote จาก `GET /api/market` (ถ้าได้)
5. `POST /api/analyze` ส่ง: deskMemory, deskRiskProfile, ethQuote
6. Server ดึง Bybit (หรือใช้ข้อมูลจาก client ถ้า server ล้ม)
7. รัน Playbook engine → Multi-agent desk → Desk narrator
8. บันทึก decision log + replay snapshot
9. ถ้า Committee **TRADE** + auto-open → เปิด paper order → sync cloud

---

## 5. Flow: POST /api/analyze (ภายใน)

| ลำดับ | ขั้นตอน |
|-------|---------|
| 1 | Normalize request (macro, overrides ค่าเริ่มต้น, risk profile, memory) |
| 2 | ดึง/รับข้อมูลตลาด (Bybit) |
| 3 | **runDecisionEngine** — 6 steps |
| 4 | **runTradingDesk** — agents ตาม pipeline |
| 5 | **enrichAnalyzeWithMvp9** — desk narrator |
| 6 | ส่ง JSON กลับ dashboard |

### Playbook 6 ขั้น

1. Market snapshot  
2. Eight-check framework  
3. No-trade rules (hard skip)  
4. Combination read  
5. Verdict (TRADE / SKIP / WAIT) + confidence  
6. Action plan (sell_call / sell_put / no_trade)

---

## 6. Flow: Multi-Agent Desk

**ลำดับ pipeline (UI Agent Roster):**

```
Research Layer (MVP 5)
  → Market Data → Regime → Data Quality → Macro & News
Desk Memory (MVP 4)
Thesis
  → Bull Thesis → Bear Thesis
Strategies
  → Spot → Futures → Options
Risk Manager (veto ได้)
Investment Committee → TRADE | SKIP | WAIT
```

**Committee พิจารณาจาก:**

- Majority ของ Spot / Futures / Options  
- Risk Manager veto (hard rules, IV/HV, liquidation, macro…)  
- Data quality score  
- โหมด **aggressive** (MVP 9): เอน TRADE เมื่อ playbook สอดคล้อง  

---

## 7. Flow: Paper Trading

```
Analyze เสร็จ
    │
    ├─ Committee TRADE + autoOpenOnTrade → สร้าง paper order (1 ออเดอร์เปิด/ครั้ง)
    │       └─ POST /api/paper/sync → Supabase
    │
    ├─ Committee SKIP/WAIT + มีออเดอร์เปิด → Auto-close
    │       └─ Sync PnL → decision log
    │
    └─ ปิดมือ → close + sync log
```

- **GET** `/api/paper/orders?status=open` — ดึงออเดอร์เปิดจาก cloud  
- Checkbox: Auto-open on TRADE, Mark-to-market, Sync to cloud  

---

## 8. Flow: การเรียนรู้ (MVP 3)

```
Decision Log (ทุก analyze)
    → Resolve outcome (มือ) → Reflection agent
    → Draft rules (advisory)
    → Agent scoreboard
    → Replay panel (snapshot ย้อนหลัง ไม่รัน engine ใหม่)
    → Journal sync Supabase (optional)
```

---

## 9. Flow: Cron / แจ้งเตือน

```
Vercel Cron → GET /api/cron/analyze (+ CRON_SECRET)
    → runAnalyzeRequest
    → บันทึก analysis_runs (Supabase)
    → Telegram (template ตาม verdict, quiet hours 22:00–08:00 BKK)
    → DESK_WEBHOOK_URL (JSON event)
    → DISCORD_WEBHOOK_URL (optional)
```

- **Quiet hours:** ไม่ ping ทั่วไปกลางคืน ยกเว้น veto / TRADE เต็ม  
- **Test:** Operations → Test automation หรือ `POST /api/alerts/test`  

---

## 10. หน้า UI (Trading Floor)

| โซน | หน้าที่ |
|-----|--------|
| Top bar | สถานะ desk, countdown refresh, toggle auto-refresh |
| Sidebar | Live BTC/ETH, analysis alerts |
| Main | Milestones, Paper trading, Trading desk, Narrator, Replay, Log preview |
| Operations | Operator (MVP 9), journal sync, scoreboard, log, rules, cron test |

**ไม่มีปุ่ม Analyze** — desk รันอัตโนมัติ

---

## 11. API ทั้งหมด

| Endpoint | หน้าที่ |
|----------|---------|
| `POST /api/analyze` | Engine + desk + narrator |
| `GET /api/market` | BTC/ETH spot |
| `GET/POST /api/paper/sync` | Sync paper orders |
| `GET /api/paper/orders?status=open` | ออเดอร์ OPEN |
| `GET/POST /api/journal/sync` | Decision log cloud |
| `GET /api/cron/analyze` | Cron + test |
| `GET /api/desk/status` | สถานะ integrations |
| `GET /api/desk/health` | Health snapshot |
| `POST /api/alerts/test` | ทดสอบ Telegram/Discord |
| `GET /api/admin/automation-status` | Cron/Telegram configured? |

---

## 12. ข้อมูล & Storage

| ที่เก็บ | เนื้อหา |
|--------|---------|
| localStorage | decision log, paper orders, desk settings, operator overrides, pins |
| Supabase | analysis_runs, paper_orders, decision_log_entries |
| Env | SUPABASE_*, CRON_SECRET, TELEGRAM_*, DESK_WEBHOOK_URL, OPENAI_API_KEY |

**Migrations:** `001` → `002` → `003` ใน `supabase/migrations/`

---

## 13. Risk Profile (MVP 9)

| โหมด | พฤติกรรม |
|------|----------|
| **aggressive** (ค่าเริ่มต้น) | Committee/engine รับ TRADE ง่ายขึ้น |
| **balanced** | ใกล้ playbook เข้มงวด |

ตั้งใน Operations → ส่ง `deskRiskProfile` ทุก analyze

---

## 14. Environment Variables

| Variable | ใช้สำหรับ |
|----------|-----------|
| `SUPABASE_URL` | Cloud storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Server sync |
| `CRON_SECRET` | Cron auth |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Alerts |
| `DESK_WEBHOOK_URL` | Webhook หลัง cron |
| `DISCORD_WEBHOOK_URL` | Discord (optional) |
| `DESK_RISK_PROFILE` | Server default risk |
| `DESK_ALERT_QUIET_HOURS` | `false` = ปิด quiet hours |
| `OPENAI_API_KEY` | LLM narrator (optional) |
| `OPENAI_MODEL` | Default gpt-4o-mini |

---

## 15. สิ่งที่ระบบไม่ทำ

- ไม่ place/cancel ออเดอร์จริงบน Bybit  
- ไม่ auto-trade จริงจาก committee TRADE (มีแค่ paper)  
- Operator override / draft rules ไม่เปลี่ยน Risk veto  
- Macro desk / Derivatives manual overrides ถูกเอาออกจาก UI  

---

## 16. แผนพัฒนาถัดไป

- **MVP 7:** Desk presets, health dashboard ละเอียด  
- **MVP 8:** Backtest ผ่าน historical runs, calibration report, ETH correlation v2  

---

*เอกสารนี้สร้างจากสถานะ codebase หลัง MVP 9 — Analysis only, no live execution.*

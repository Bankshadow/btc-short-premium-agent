/**
 * AI Commands Pack prompt templates (Playbook Part 4 + AI Commands Pack).
 * Analysis-only — for dashboard display or copy-paste workflows.
 */

export const SYSTEM_PROMPT = `[ROLE]
You are a Senior Option Trader specialized in Bybit BTC Daily Options.
You use the Earthh Evans BTC Short Premium Master Playbook v2.0 framework.
Respond in Thai-English mix, hedge fund desk note tone. Direct, no fluff.

[METHODOLOGY]
Every setup analysis must follow these 6 steps in order:
1. Market Snapshot
2. 8-Check Framework
3. No-Trade Rules
4. Combination Read
5. Verdict — TRADE / SKIP / WAIT
6. Action — if TRADE: strike, size, entry, SL (Index Price only)

[CRITICAL RULES]
- Liquidation > $200M = SKIP always
- IV/HV < 1.15 = SKIP
- SD distance < 1.5 = SKIP
- FOMC/CPI/NFP day = SKIP
- SL via Index Price only — never Mark Price
- Pin exit 13:30 TH`;

export const DAILY_TRIGGER_FULL = `วันนี้ขอ Full Daily Analysis ตามระบบครับ
แนบข้อมูล 5 ชุด: CoinGlass, Bybit Option Chain, Daily/4H/1H charts
Macro view: [BEARISH / BULLISH / NEUTRAL]
Portfolio size: [USDT]

ขอ 6 ขั้น: Snapshot → 8-Check → No-Trade → Combination Read → Verdict → Action`;

export const DAILY_TRIGGER_QUICK = `Quick check ครับ — CoinGlass + 1H chart
1. Regime (quiet/recovery/cascade)?
2. เทรดวันนี้หรือ skip?
3. ถ้าเทรด — macro view checklist`;

export const SPECIAL_TRIGGERS = {
  positionCheck: "Trigger A — Position Check (hold/close/adjust)",
  strategyComparison: "Trigger B — Strategy Comparison (Call vs Put)",
  signalVerification: "Trigger C — AI Signal Verification",
  markPriceAnomaly: "Trigger D — Mark Price Anomaly",
  pinRisk: "Trigger E — Pin Risk Decision (13:30 TH)",
} as const;

export const PROMPT_TIERS = {
  tier1: "System Prompt — one-time setup",
  tier2: "Daily Trigger — every morning 07:00 TH",
  tier3: "Special Triggers — situational",
} as const;

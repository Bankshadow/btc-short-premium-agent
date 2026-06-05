# คู่มือตั้งค่า Bybit Testnet + Live Perp (ภาษาไทย)

> เทรดจริงได้เฉพาะ **Perp** (BTC/SOL/WLD/LINK/DOGE) · BTC Options ยังเป็น paper เท่านั้น

---

## สิ่งที่ทำอัตโนมัติให้แล้วใน repo

| ไฟล์ | ทำอะไร |
|------|--------|
| `npm run setup:testnet` | Wizard สร้าง `.env.local` + เปิดหน้า Bybit testnet |
| `npm run verify:exchange` | ทดสอบ key กับ Bybit testnet API |
| `scripts/push-vercel-env.ps1` | อัปโหลด env ขึ้น Vercel |

---

## ขั้นตอนแบบเร็ว (3 นาที)

### 1. สร้าง API Key ที่ Bybit Testnet

1. เปิด [testnet.bybit.com](https://testnet.bybit.com) → สมัคร/ล็อกอิน (คนละบัญชีกับ mainnet)
2. ขอเงินทดสอบ (Demo USDT) ถ้ายังไม่มี
3. ไป [API Management](https://testnet.bybit.com/app/user/api-management)
4. **Create New Key** → System-generated
5. สิทธิ์: **Read + Trade** (ปิด Withdraw)
6. คัดลอก API Key + Secret (Secret แสดงครั้งเดียว)

### 2. รัน wizard บนเครื่องคุณ

```powershell
cd c:\Users\User\Desktop\project\btc-short-premium-agent\btc-short-premium-agent
npm run setup:testnet
```

วาง Key/Secret ตามที่ถาม → สคริปต์สร้าง `.env.local` และทดสอบการเชื่อมต่อ

### 3. รัน local

```powershell
npm run dev
```

- [http://localhost:3000/governance](http://localhost:3000/governance) → Exchange Status ต้องขึ้น **testnet**
- [http://localhost:3000/assets](http://localhost:3000/assets) → Scan → **Preview** → ติ๊ก double confirm → **Execute Live**

### 4. ขึ้น Production (Vercel)

```powershell
npm run push:vercel-env
```

หรือตั้งมือที่ Vercel → Settings → Environment Variables:

| Variable | ค่าแนะนำ (testnet) |
|----------|-------------------|
| `BYBIT_API_KEY` | จาก testnet.bybit.com |
| `BYBIT_API_SECRET` | จาก testnet.bybit.com |
| `BYBIT_TESTNET` | `true` |
| `CRON_SECRET` | สุ่มยาว 32+ ตัว |
| `LIVE_EXECUTION_ENABLED` | `true` (ถ้าจะ execute) |
| `LIVE_MAX_NOTIONAL_USD` | `50` (เริ่มเล็ก) |
| `LIVE_ALLOWED_SYMBOLS` | `BTCUSDT,SOLUSDT,DOGEUSDT` |

**Redeploy** หลังเปลี่ยน env ทุกครั้ง

---

## วิธีเทรดบน Production

1. เปิด `https://btc-short-premium-agent.vercel.app/assets`
2. กด Scan → เลือกสัญญาณที่ actionable
3. Preview order → ตรวจ notional / margin
4. ติ๊ก **I confirm live execution** → Execute

ระบบ **ไม่ auto-live** — ต้องกด execute เองทุกครั้ง

---

## แก้ปัญหา

| อาการ | แก้ |
|-------|-----|
| Invalid API key (10003) | ใช้ key จาก **testnet** ไม่ใช่ bybit.com จริง |
| LIVE blocked | ตั้ง `LIVE_EXECUTION_ENABLED=true` แล้ว redeploy |
| Execute ไม่มี token | ตั้ง `CRON_SECRET` |
| Balance 0 | ขอ demo USDT ที่ testnet.bybit.com |
| สร้าง key ไม่ได้ | บัญชีใหม่อาจรอ 48 ชม. (นโยบาย Bybit) |

---

## สิ่งที่ AI ทำให้ไม่ได้ (ต้องทำเอง)

- สมัครบัญชี Bybit testnet + 2FA
- สร้าง API key (ต้องยืนยันตัวตนบนเว็บ Bybit)
- Login Vercel (`vercel login`) เพื่อ push env

หลังทำ 3 อย่างนี้ รัน `npm run setup:testnet` ที่เหลือระบบช่วยได้เกือบหมด

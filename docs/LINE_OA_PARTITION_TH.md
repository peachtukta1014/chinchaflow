# LINE OA Partition — 4 สายงาน CHINCHA FLOW

จัด partition LINE เพื่อให้ agent รู้ว่า event ไหนวิ่งเข้าที่ไหน — ไม่มั่วเวลา debug หรือต่อยอด

**อัปเดต 2026-06-19** — รวม AI Chat เข้า webhook-core

---

## แผนภาพ 4 สาย

```
ลูกค้า / พนักงาน / เจ้าของ
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│  LINE Messaging API                                      │
│                                                          │
│  ┌────────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ OA กุ้ง         │  │ OA ชา      │  │ LINE Notify    │  │
│  │ (seafood)       │  │ (tea)      │  │ (push only)    │  │
│  └───────┬────────┘  └─────┬──────┘  └───────┬───────┘  │
└──────────┼─────────────────┼──────────────────┼──────────┘
           │                 │                  │
           ▼                 ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│  webhook-core (asia-southeast1)                          │
│                                                          │
│  สายที่ 1 ──────────────────────────────────────────     │
│  lineWebhook → shrimpLineWebhookRouter                   │
│    ├─ OA Direct: shrimpDirectLineWebhook                 │
│    │    follow welcome, help, LIFF, cancel,              │
│    │    รูปสลิป direct, text สั่งกุ้ง, ผูก UID           │
│    └─ Group/Room: shrimpGroupLineWebhook                 │
│         รูปสลิป (guard), summary, today_orders,          │
│         text สั่งกุ้งในกลุ่ม                              │
│                                                          │
│  สายที่ 2 ──────────────────────────────────────────     │
│  lineWebhookTea → classifyTeaLineCommand                 │
│    help, summary, ignore กลุ่มที่ไม่ใช่ notifyGroupId     │
│                                                          │
│  สายที่ 3 ──────────────────────────────────────────     │
│  instantLineNotify (push outbound)                       │
│    notifyShrimpLineOrder, notifyShrimpPaymentSlip,       │
│    notifyShrimpSaleDeleteRequest, notifyTeaRestock        │
│                                                          │
│  สายที่ 4 ──────────────────────────────────────────     │
│  aiChatAgentHttp (AI Chat — ไม่ใช่ LINE)                  │
│    HTTP endpoint สำหรับ PWA ai-chat                      │
│    classifier → 5 agent scopes → OpenRouter               │
└──────────────────────────────────────────────────────────┘
```

---

## สาย 1 — LINE OA กุ้ง (ลูกค้าสั่ง)

| ชื่อ | ไฟล์ | หน้าที่ |
|------|------|--------|
| Entry | `index.js` → `exports.lineWebhook` | Verify signature + dedup |
| Router | `shrimpLineWebhookRouter.js` | แยก direct vs group/room |
| Direct | `shrimpDirectLineWebhook.js` | แชทตรง OA: follow welcome, help, LIFF order, LIFF slip, cancel, รูปสลิป, text สั่ง, ผูก UID |
| Group | `shrimpGroupLineWebhook.js` | กลุ่ม/room: รูปสลิป (guard กลุ่ม + บิลค้าง), summary, today_orders, text สั่งกุ้ง |
| Parser | `parseLineOrder.js` | แปลงข้อความ → ออเดอร์กุ้ง |
| Save | `saveShrimpLineOrders.js` | บันทึก `lineOrders` + `customers` |
| Intent | `shrimpLineIntent.js` | คำสั่ง help/summary/cancel |
| LIFF | `shrimpLiffOrderSubmit.js` | รับ submit จาก LIFF ฟอร์มสั่ง |
| LIFF | `shrimpLiffSlip.js` | รับ submit จาก LIFF ฟอร์มฝากสลิป |
| Push | `shrimpLinePush.js` | Push บิลให้ลูกค้า |

**Context keys:**
- `sourceType=user` + ไม่มี `groupId` → **direct**
- `sourceType=group` หรือ `sourceType=room` → **group**
- ทุก event ผ่าน `claimLineEvent` dedup

**Secrets:**
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LINE_LIFF_ID` / `VITE_LIFF_ID`
- `LINE_LIFF_SLIP_ID` / `VITE_LIFF_SLIP_ID`

**URL:** `https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhook`

---

## สาย 2 — LINE ครอบครัวกุ้ง + แจ้งเตือนกลุ่ม (อยู่รวมในสาย 1)

กลุ่ม LINE กุ้งใช้ `shrimpGroupLineWebhook.js` — อยู่ภายใต้ `lineWebhook` เดียวกัน router แยก context ให้

| ความสามารถ | เงื่อนไข |
|-----------|----------|
| สั่งกุ้ง | ลูกค้าผูก UID แล้วได้ชื่อร้านจากแอป |
| เช็คยอด `summary` | `config/shrimpLine.notifyGroupId` |
| เช็คออเดอร์ `today_orders` | groupId ตรงกับที่ตั้ง |
| รูปสลิปในกลุ่ม | ต้องเป็นกลุ่มที่อนุญาต + มีบิลค้างเปิด (guard) |
| แจ้งเตือนทันที | `shrimpLineConfig.instantOrderNotify` — push เข้า `notifyGroupId` |

**ไม่ทำในกลุ่ม:** help, LIFF, cancel — สงวนไว้สำหรับแชทตรง OA

---

## สาย 3 — LINE แอปชา (สรุป + help)

| ชื่อ | ไฟล์ | หน้าที่ |
|------|------|--------|
| Entry | `index.js` → `exports.lineWebhookTea` | Verify signature, dedup |
| Classifier | `teaDailySummary.js` → `classifyTeaLineCommand` | help / summary / ignore |
| Summary | `teaDailySummary.js` → `dispatchTeaSummary` | สร้างข้อความสรุป + push กลุ่ม |
| Push มือ | `index.js` → `exports.teaPushSummary` | แอดมินกดส่งสรุปจาก PWA |

**Context:**
- Accept: event ในกลุ่มที่ตรงกับ `config/teaLine.notifyGroupId` เท่านั้น
- Ignore: กลุ่มที่ไม่ใช่ — ตอบ `⚠️ กลุ่มนี้ไม่ตรงกับที่ตั้ง`
- Accept: OA direct / room (ถ้าไม่มี notifyGroupId)

**Commands:**
| พิมพ์ | ตอบ |
|-------|------|
| `help`, `ช่วยเหลือ`, `h` | HELP_TEXT |
| `summary`, `สรุป` | สรุปยอดวันนี้ + รายการขาย |
| อื่น ๆ | ไม่ตอบ (ไม่รับออเดอร์ลูกค้า) |

**Secrets:**
- `LINE_TEA_CHANNEL_ACCESS_TOKEN`
- `LINE_TEA_CHANNEL_SECRET`

**URL:** `https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhookTea`

---

## สาย 4 — LINE แจ้งเตือนขาออก (Push only)

ฟังก์ชันใน `instantLineNotify.js` — ไม่รับ event, push อย่างเดียว เรียกจาก Firestore triggers หรือโค้ดในฟังก์ชันอื่น

| ฟังก์ชัน | Trigger | ส่งไปที่ |
|----------|---------|----------|
| `notifyShrimpLineOrder` | Firestore `lineOrders.{id}` onCreate | `notifyGroupId` ตาม `shrimpLineConfig` |
| `notifyShrimpPaymentSlip` | Firestore `paymentSlipSubmissions.{id}` onCreate | กลุ่ม config |
| `notifyShrimpSaleDeleteRequest` | Firestore `shrimpAdminAlerts.{id}` onCreate | กลุ่มแอดมิน |
| `notifyTeaRestock` | Firestore `restocks.{id}` onCreate | กลุ่มชา |

---

## สาย 5 — AI Chat (HTTP, ไม่ใช่ LINE)

| ฟังก์ชัน | ไฟล์ | หน้าที่ |
|----------|------|--------|
| `aiChatAgent` | `aiChatAgent.js` | V2 onCall — 5 agent scopes |
| `aiChatAgentHttp` | `aiChatAgent.js` | V1 onRequest — PWA ai-chat เรียกตรง |

**PWA URL:** `https://chincha-ai-chat.web.app`

**Secrets:** `OPENROUTER_API_KEY` (root `.env` / GitHub Secrets)

---

## สรุป Secrets ทั้งระบบ (LINE + AI)

| Secret | ใช้ใน |
|--------|--------|
| `LINE_CHANNEL_ACCESS_TOKEN` | สาย 1 (กุ้ง) + สาย 4 (push) |
| `LINE_CHANNEL_SECRET` | สาย 1 (verify) |
| `LINE_TEA_CHANNEL_ACCESS_TOKEN` | สาย 3 (ชา) |
| `LINE_TEA_CHANNEL_SECRET` | สาย 3 (verify) |
| `LINE_LIFF_ID`, `LINE_LIFF_SLIP_ID` | สาย 1 (LIFF) |
| `OPENROUTER_API_KEY` | สาย 5 (AI Chat) |

---

## คำถามที่พบบ่อย

**Q: ทำไมกุ้งมีแยก OA / กลุ่ม / แจ้งเตือนแต่ใช้ webhook เดียวกัน?**  
A: `lineWebhook` ฟังก์ชันเดียวรับทุก event — router (`shrimpLineWebhookRouter`) แยกตาม `source.type` เป็น direct/group/room ให้ handler คนละตัวดูแล ทำให้แก้ไม่กระทบกัน

**Q: สลิปในกลุ่มกับ OA ต่างกันยังไง?**  
A: OA direct — รับรูปสลิปเสมอถ้าผู้ใช้ผูก UID · กลุ่ม — ต้องผ่าน guard (ต้องเป็นกลุ่มที่ตั้ง + มีบิลค้างเปิด) เพื่อกันรูปทั่วไปไม่ให้ถูกเข้าใจผิด

**Q: AI Chat ใช้ LINE ไหม?**  
A: ไม่ใช้ — เป็น HTTP endpoint แยก เรียกจาก PWA `https://chincha-ai-chat.web.app` โดยตรง
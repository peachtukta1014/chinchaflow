# CHINCHA FLOW

**ชื่อระบบรวม (แบรนด์):** CHINCHA FLOW · **repo (เทคนิค):** `chincha-business-os` · **GitHub:** `peachtukta1014/chinchaflow` · **คลาวด์:** Firebase `chincha-eeed6`

แพลตฟอร์มปฏิบัติการธุรกิจแบบ monorepo สำหรับร้านจริง 2 ฝั่ง — **โกอ้วนซีฟู้ด** + **ชินชา ไม้ขาว** — พร้อม LINE backend และ AI เลขาส่วนตัว อยู่ใน repo เดียวกัน

> 📂 โครงสร้างไฟล์ละเอียด + ต้นไม้โปรเจกต์ (อัปเดตอัตโนมัติ) → [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
> 🏷️ ชื่อระบบ + คำเรียกสากล → [docs/CHINCHA_FLOW_NAMING_TH.md](docs/CHINCHA_FLOW_NAMING_TH.md)

---

## แอปใน CHINCHA FLOW

| แอป | โฟลเดอร์ | URL | บทบาทหลัก |
|-----|----------|-----|-----------|
| 🦐 **โกอ้วนซีฟู้ด** | `apps/seafood-pos` | https://ko-seafood.top | POS กุ้ง, สต๊อก FIFO, ลูกค้า, ลูกหนี้, LINE order, LIFF |
| 🧋 **ชินชา Tea POS** | `apps/chincha-tea` | https://chincha-tea.web.app | POS ร้านน้ำ, ปิดวัน, สต๊อกแก้ว, สั่งของ, ค่าใช้จ่าย, 3 ภาษา |
| 🌸 **AI Admin Chat (จีจี้)** | `apps/ai-chat` | https://chincha-ai-chat.web.app | แชทกับเลขา AI — ถามข้อมูลร้าน, แก้โค้ด+เปิด PR, ส่งรูป/ไฟล์ |
| 🤖 **LINE backend** | `apps/webhook-core` | Cloud Functions | webhook กุ้ง/ชา, สรุปยอด, แจ้งเตือน, AI chat agent |

> `apps/webhook-core-scheduled` — สำรองไว้เผื่อแยก deploy งาน scheduled (cron) เป็น codebase ต่างหาก

---

## 🌸 AI Admin Chat — "จีจี้" เลขาส่วนตัว

PWA แชทกับ AI ผู้ช่วยส่วนตัวพีช — เพื่อนคู่คิด แนะนำ ตักเตือน และลงมือแก้โค้ดให้จริง

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 💬 Text chat | ถามข้อมูลร้าน วิเคราะห์ปัญหา แนะนำแนวทาง |
| 🎤 Voice input | พูดภาษาไทย (Web Speech API) |
| 📸 Image / 📎 File | แนบรูป screenshot/error (vision) หรือไฟล์ข้อความให้ AI อ่าน |
| 🔧 Code-action | สั่ง "แก้บั๊ก / เพิ่มฟีเจอร์" → AI อ่านโค้ดจริง → commit → เปิด PR อัตโนมัติ |
| ⚡ Auto-merge | งาน low-risk (UI/text/doc) CI ผ่าน → merge + deploy เองอัตโนมัติ; งานสำคัญถามยืนยันก่อน |
| 🔔 Deploy banner | แจ้ง "✅ Deploy เสร็จ" ในแอปหลัง deploy เสร็จ |
| ⌨️ Quick triggers | พิมพ์ `โอเคกุ้ง` / `โอเคชา` → ตรวจสุขภาพแอป (อ่านอย่างเดียว) |
| 🗂 Multi-scope | สลับ scope: ทั่วไป / ชา / กุ้ง / LINE Bot / Cron |

**โมเดล (3-tier ผ่าน OpenRouter):**

| ชั้น | โมเดล | ใช้ตอน |
|------|-------|--------|
| 🟢 Flash | `deepseek-v4-flash` | classify intent + แชททั่วไป (เร็ว/ถูก) |
| 🟡 Pro | `deepseek-v4-pro` | agentic loop เขียนโค้ดจริง (commit/PR) |
| 🔵 Vision | `gpt-4o-mini` | มีรูปแนบ |

ก่อนลงมืองานสำคัญ จีจี้จะสรุป **หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ** แล้วรอยืนยัน

**Backend:** `aiChatAgentHttp` (Cloud Function) — entry point เดียวที่ ai-chat เรียก

---

## พัฒนา local

```bash
npm install
npm run dev:tea                                # แอปชา
npm run dev:seafood                            # แอปกุ้ง
npm run dev --workspace=ai-chat                # AI Chat
```

**ตรวจสุขภาพก่อน merge:**

```bash
node apps/seafood-pos/scripts/smoke-test.mjs   # logic กุ้ง (ไม่ต้อง Firebase)
npm run build --workspace=seafood-pos          # ถ้าแตะแอปกุ้ง
npm run build --workspace=chincha-tea          # ถ้าแตะแอปชา
```

---

## Deploy (GitHub Actions)

push `main` แล้วรันเฉพาะ workflow ที่ไฟล์เกี่ยวข้องเปลี่ยน:

| Workflow | เมื่อไฟล์เปลี่ยน | ผลลัพธ์ |
|----------|------------------|---------|
| `deploy-hosting.yml` | `apps/seafood-pos`, `apps/chincha-tea`, `apps/ai-chat` | deploy hosting + แจ้งสถานะกลับ ai-chat |
| `deploy-functions.yml` | `apps/webhook-core` | deploy Cloud Functions + แจ้งสถานะกลับ ai-chat |
| `deploy-rules.yml` | `firestore*.rules`, `storage.rules` | deploy security rules |
| `pr-verify.yml` | ทุก PR | smoke test + build + auto-merge PR ที่ติด `[auto-merge]` |
| `sync-project-tree.yml` | push `main` | อัปเดตต้นไม้ใน `docs/PROJECT_STRUCTURE.md` อัตโนมัติ |
| `code-metrics.yml` | push `main` | วัด metrics → `docs/CODE_METRICS.md` + `reports/` |

รันมือ: GitHub → **Actions** → เลือก workflow → **Run workflow**

---

## คำสั่งดูแลข้อมูล (สรุป)

| งาน | local | cloud |
|-----|-------|-------|
| เคลียร์ DB ร้านชา | `npm run tea:db-reset:dry` → `:all` | Actions → **Tea DB Reset** |
| รีเซ็ตสต๊อกกุ้ง | `npm run shrimp:stock-reset:dry` → `shrimp:stock-reset` | Actions → **Shrimp Stock Reset** |

> รอบจริงเปิด dry run ก่อนเสมอ แล้วค่อยรันจริง (พิมพ์ `RESET` ใน confirm ถ้ามี)

LINE กุ้ง — Webhook URL ต้องชี้ที่ `…/lineWebhook` (ไม่ใช่ `lineWebhookTea`)

---

## เอกสารเพิ่ม

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — โครงสร้างเต็ม + Firestore collections + ต้นไม้ (auto-sync)
- [docs/ARCHITECTURE_TH.md](docs/ARCHITECTURE_TH.md) — สถาปัตยกรรมระบบ
- [docs/AGENT_HANDBOOK_TH.md](docs/AGENT_HANDBOOK_TH.md) — คู่มือ AI agent + แผนที่ repo
- [docs/PEACH_WORKING_STYLE_TH.md](docs/PEACH_WORKING_STYLE_TH.md) — สไตล์การสั่งงานของพีช
- [JIIJI.md](JIIJI.md) · [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) — ตัวตน + กฎ AI agent

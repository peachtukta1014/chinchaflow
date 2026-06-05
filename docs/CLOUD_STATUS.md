# เช็คสถานะบนคลาว (chincha-eeed6)

**Deploy ฝั่งเว็บ:** Firebase Hosting เท่านั้น (GitHub Actions `deploy-hosting.yml`) — **ไม่ใช้ Vercel**

ถ้าบน GitHub repo ยังเห็นลิงก์ `*.vercel.app` ด้านบน หรือ environment ชื่อ Preview / Production จาก Vercel:

1. GitHub → **Actions** → **Disconnect Vercel from GitHub** → **Run workflow** (ล้าง homepage + environments บน repo)
2. [vercel.com](https://vercel.com) → โปรเจกต์ที่ผูก repo นี้ → **Settings → Git → Disconnect** (หรือลบโปรเจกต์)
3. GitHub → **Settings** (บัญชี) → **Integrations** → **Vercel** → เอา `chinchaflow` ออกจากสิทธิ์ (ถ้ายังติด)

---

## Hosting — ใช้งานได้
| แอพ | URL |
|-----|-----|
| ชินชา | https://chincha-tea.web.app |
| กุ้ง | https://ko-seafood.top |

## Cloud Functions — ต้องเขียวใน Console
Console → Build → Functions → ควรเห็น:
- `lineWebhook`, `lineWebhookTea`, `teaPushSummary` (region asia-southeast1)
- `teaDailyScheduledSummary` (codebase tea-scheduled, ถ้า deploy สำเร็จ)

URL ทดสอบ (GET อาจได้ 405/503 ถ้ายังไม่ deploy):
- https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhookTea
- https://asia-southeast1-chincha-eeed6.cloudfunctions.net/teaPushSummary

## Firestore
- Database: **(default)** — แอพชาใช้ตัวนี้
- Collections ชา: `teaOrders`, `products`, `users`, `config/teaLine`, `restocks`

## เคลียร์ข้อมูลชา
GitHub → Actions → **Tea DB Reset** → Run workflow

## Cursor + Firebase MCP (บนเว็บ)
ในแชทที่เปิด MCP แล้ว ลอง:
- "List Cloud Functions in project chincha-eeed6"
- "Show Firestore documents in teaOrders for today"

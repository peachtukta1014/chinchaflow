# เช็คสถานะบนคลาว (chincha-eeed6)

## Hosting — ใช้งานได้
| แอพ | URL |
|-----|-----|
| ชินชา | https://chincha-tea.web.app |
| กุ้ง | https://chincha-shrimp.web.app |

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

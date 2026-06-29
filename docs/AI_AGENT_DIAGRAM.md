# CHINCHA FLOW — AI Agent Architecture Diagram

อัปเดต: 2026-06-29 · ตรงกับ codebase จริง (PR #394 + Flash Code Reader)

---

## ภาพรวม: 2-Team Async Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  พีช (เจ้าของร้าน)                                                      │
│  พิมพ์ข้อความในแชท ai-chat PWA                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ POST /aiChatAgentHttp
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 FLASH AGENT — aiChatAgentHttp                                             │
│  Cloud Function · asia-southeast1 · 512MB · 540s · OPENROUTER_API_KEY         │
│  Model: deepseek/deepseek-v4-flash (แชท) · openai/gpt-4o-mini (รูป)          │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Flowchart แบบละเอียด

```mermaid
flowchart TD
    A([👤 พีชพิมพ์ข้อความ\nใน ai-chat PWA]) --> B[POST /aiChatAgentHttp\nส่ง message + history + scope + requestId]

    B --> C{ตรวจสอบ\nประเภทคำสั่ง}

    C -->|isCodeMetricsQuery| CM[📊 ดึง docs/CODE_METRICS.md\nจาก GitHub API\nตอบกลับทันที]
    CM --> Z([💬 PWA แสดงผล])

    C -->|detectQuickTrigger\nโอเคกุ้ง / โอเคชา| QT[dispatchToProAgent\nส่ง repository_dispatch\nscope=seafood/tea\nisHighRisk=false]
    QT --> FS1[(Firestore\naiProgress/requestId\nclear)]
    QT --> RQ([💬 กำลังตรวจ... + requestId])

    C -->|ข้อความทั่วไป| CL[🧠 classifyAndTranslate\nFlash Model · temp=0.1 · max_tokens=600\nวิเคราะห์ intent]

    CL --> D{intent?}

    D -->|chat| CH[โหลด context\n① JIIJI.md จาก GitHub\n② AGENTS.md + docs จาก GitHub\n③ project tree จาก Firestore\nTTL: 10 นาที / 5 นาที]
    CH --> CR[callOpenRouter\nFlash Model\ntemp=0.3 · max_tokens=2048]
    CR -->|ผลลัพธ์ปกติ| WR1[(Firestore\naiResults/requestId)]
    CR --> Z

    CR -->|ตรวจพบ [WEB_SEARCH: query]| WS[🌐 Web Search\ncallOpenRouterForWebSearch\ndeepseek/deepseek-chat\n+ web plugin · max_results=3]
    WS --> WSR[ได้ผลจากเว็บ\nส่งกลับให้ Flash\nเป็น context เพิ่มเติม]
    WSR --> CR2[callOpenRouter\nFlash Model อีกครั้ง\nตอบสรุปพร้อมแหล่งข้อมูล]
    CR2 --> WR1

    D -->|code-action\nneedsConfirmation=true| CF[ส่ง confirmationMessage\nกลับให้พีชยืนยัน\nstatus=pending-code-action]
    CF --> Z
    A -->|พีชพิมพ์ ทำเลย\nneedsConfirmation=false| CL

    D -->|code-action\nneedsConfirmation=false| FCR[🔍 Flash Code Reader\nGH_PAT_READ → fetchRepoFiles\nfiles_hint สูงสุด 5 ไฟล์ × 3,000 chars\nแนบเข้า Task Brief]
    FCR --> CA[dispatchToProAgent\nGH_PAT_DISPATCH||GH_PAT\nPOST github.com/repos/dispatches\nevent_type=ai-code-action\n+ Task Brief พร้อมโค้ด]
    CA --> FS2[(Firestore\naiProgress/requestId\nclear)]
    CA --> RP([💬 รับงานแล้ว กำลังดำเนินการ\nstatus=processing + requestId])

    subgraph POLLING["🔄 PWA Polling Loop (ทุก 2-3 วิ)"]
        P1[GET /aiChatAgentHttp\n?action=progress&requestId=xxx] --> P2[(Firestore\naiProgress/requestId)]
        P3[GET /aiChatAgentHttp\n?action=result&requestId=xxx] --> P4[(Firestore\naiResults/requestId)]
    end

    CA --> POLLING

    subgraph GHA["🔵 PRO AGENT — GitHub Actions"]
        GH1[ai-workflow-trigger.yml\nรับ repository_dispatch\nevent: ai-code-action] --> GH2[run-github-agent.mjs\nparse AGENT_TASK_PAYLOAD]
        GH2 --> GH3[handleCodeActionV2\naiWorkflowAgent.js\nOPENROUTER_API_KEY_PRO]
        GH3 --> GH4[fetchAgentDocs\nอ่าน AGENTS.md + docs\nจาก GitHub API]
        GH4 --> GH5[buildAgentSystemPrompt\nSCOPE_FILE_TREE\nเลือกไฟล์ตาม scope]
        GH5 --> GH6[runAgentLoop\nagentTools.js\nMAX_ITERATIONS=30\nCHECKPOINT=25]

        GH6 --> TOOL{AI เลือก tool\nทีละขั้น}
        TOOL -->|read_file| T1[GitHub API\nดึงเนื้อไฟล์]
        TOOL -->|list_files| T2[GitHub API\nดูรายการไฟล์]
        TOOL -->|search_code| T3[GitHub API\nค้นหาโค้ด]
        TOOL -->|patch_file\nwrite_file| T4[แก้โค้ดใน memory]
        TOOL -->|commit_and_pr| T5[GitHub API\nสร้าง branch + commit\n+ เปิด PR อัตโนมัติ]
        TOOL -->|trigger_deploy| T6[GitHub Actions\ndeploy workflow]
        TOOL -->|report_no_action_needed| T7[ไม่ต้องแก้ รายงานผล]

        T1 & T2 & T3 & T4 --> TOOL
        T5 --> GH7[writeResult\nFirestore aiResults/requestId\nreply + PR URL + scope\nTTL 2 ชั่วโมง]
        T7 --> GH7
    end

    GHA --> PR_V[pr-verify.yml\nsmoke test + build\ncomment ผลใน PR]
    GH7 --> WR2[(Firestore\naiResults/requestId\nTTL 2 ชั่วโมง)]
    POLLING --> WR2
    WR2 --> Z2([💬 PWA แสดงผลสุดท้าย\nรวม PR URL])

    subgraph TREE_SYNC["📁 Project Tree Sync"]
        TS1[sync-project-tree.yml\nทุกครั้งที่ push main] --> TS2[อ่าน docs/PROJECT_STRUCTURE.md\nส่งไป deployNotifyHttp\naction=project_tree]
        TS2 --> TS3[(Firestore\nsystemConfig/projectTree\nTTL 5 นาที)]
        TS3 --> CH
    end

    style A fill:#e8f5e9,stroke:#4caf50
    style GHA fill:#e3f2fd,stroke:#2196f3
    style POLLING fill:#fff8e1,stroke:#ff9800
    style TREE_SYNC fill:#fce4ec,stroke:#e91e63
    style FS1 fill:#f3e5f5,stroke:#9c27b0
    style FS2 fill:#f3e5f5,stroke:#9c27b0
    style WR1 fill:#f3e5f5,stroke:#9c27b0
    style WR2 fill:#f3e5f5,stroke:#9c27b0
```

---

## Security Isolation Model

```
┌──────────────────────────────────┐   ┌──────────────────────────────────────┐
│  🟢 Flash CF (Cloud Function)    │   │  🔵 Pro Agent (GitHub Actions)       │
│                                  │   │                                      │
│  Secrets (Firebase / GitHub):    │   │  Secrets (GitHub Secrets only):      │
│  ✅ OPENROUTER_API_KEY           │   │  ✅ OPENROUTER_API_KEY_PRO           │
│  ✅ GH_PAT (read + dispatch)     │   │  ✅ GH_PAT (read + write + PR)       │
│  ❌ OPENROUTER_API_KEY_PRO       │   │  ✅ FIREBASE_SERVICE_ACCOUNT         │
│  ❌ FIREBASE_SERVICE_ACCOUNT     │   │  ❌ OPENROUTER_API_KEY (Flash)       │
│                                  │   │                                      │
│  ทำได้:                          │   │  ทำได้:                              │
│  ✅ classify intent              │   │  ✅ อ่านไฟล์ใน repo                  │
│  ✅ ตอบแชทพีช                   │   │  ✅ แก้/เขียนไฟล์                    │
│  ✅ ส่ง dispatch → Pro           │   │  ✅ commit + เปิด PR                 │
│  ✅ อ่าน project tree            │   │  ✅ เขียน Firestore (ผ่าน SA)        │
│  ✅ poll Firestore (อ่าน)        │   │  ✅ trigger deploy workflow           │
│  ❌ แก้ไฟล์ใน repo              │   │  ❌ ตอบแชทพีชโดยตรง                 │
│  ❌ commit / เปิด PR             │   │                                      │
└──────────────────────────────────┘   └──────────────────────────────────────┘
              │ repository_dispatch (event: ai-code-action)          │
              │ client_payload: {requestId, message, scope, history} │
              └─────────────────────────────────────────────────────►│
              │                                                       │
              │◄──────────────── Firestore aiResults/{requestId} ────┘
              │  {reply, scope, PR URL, status}
```

---

## สถานะ requestId ตลอดวงจรชีวิต

```
พีชส่งข้อความ
     │
     ▼
Flash CF สร้าง requestId (ถ้าไม่มีจาก client)
     │
     ├─► Firestore aiProgress/{requestId}  ← "กำลังวิเคราะห์..."
     │
     ├─► dispatch → Pro Agent รับงาน
     │        │
     │        ├─► aiProgress/{requestId}  ← "กำลังโหลดบริบท..."
     │        ├─► aiProgress/{requestId}  ← "กำลังอ่านไฟล์ X..."
     │        ├─► aiProgress/{requestId}  ← "กำลัง patch..."
     │        └─► aiProgress/{requestId}  ← "กำลัง commit..."
     │
     ├─► Pro เสร็จ → aiResults/{requestId}  ← {reply, PR URL}
     │             → aiProgress/{requestId}  ← DELETE
     │             → agentRunLogs/{requestId}/steps  ← log ถาวร
     │
     └─► PWA poll อ่าน aiResults → แสดงผล → clearResult (DELETE)
```

---

## 5 Agent Scopes

| Scope | ร้าน/ระบบ | ไฟล์ใน SCOPE_FILE_TREE | Firestore Collections |
|-------|-----------|------------------------|----------------------|
| `seafood` | โกอ้วนซีฟู้ด (กุ้ง) | apps/seafood-pos/src/** (100+ ไฟล์) | sales, stockBatches, lineOrders, customerDebts |
| `tea` | ชินชา Tea POS | apps/chincha-tea/src/** (70+ ไฟล์) | teaOrders, dailyCupStocks, restocks |
| `webhook` | LINE Bot | apps/webhook-core/src/** | lineWebhook events, config/shrimpLine |
| `scheduled` | Cron / Auto | teaDailySummary, shrimpDailySummary | scheduled triggers |
| `root` | ทั้งระบบ | seafood + tea + webhook รวมกัน | ทุก collection |

---

## Loop Limits (agentTools.js)

```
MAX_ITERATIONS     = 30   — หยุดแน่นอน + emergency commit ถ้ามีไฟล์ staged
SUMMARY_CHECKPOINT = 25   — รอบ 25 บังคับสรุปความคืบหน้า แล้วดำเนินต่อ
timeout GitHub Actions = 30 นาที
```

---

## Web Search Flow (Flash เท่านั้น)

เพิ่มใน PR #394 — Flash ตรวจ output ตัวเองก่อนส่งกลับ:

```
① Flash ตอบมา → ตรวจพบ [WEB_SEARCH: query] ในผลลัพธ์
                       │
② callOpenRouterForWebSearch(query)
   model: deepseek/deepseek-chat
   plugins: [{ id: 'web', max_results: 3 }]
                       │
③ ได้ผลจากเว็บ (snippet + URL) → ส่งเป็น context เพิ่มให้ Flash
                       │
④ Flash เรียก callOpenRouter อีกครั้ง → ตอบสรุปพร้อมแหล่งอ้างอิง
```

**กฎ:** Pro Agent ไม่มี web search — ค้นเว็บได้แค่ Flash (Cloud Function) เท่านั้น

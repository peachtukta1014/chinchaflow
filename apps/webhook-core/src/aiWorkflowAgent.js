/**
 * AI Workflow Agent — Cloud Function for CHINCHA FLOW
 *
 * Receives code-action intent from aiChatAgent, spawns a Cursor Cloud Agent
 * via the Cursor Cloud REST API (/v1/agents) to autonomously:
 *   - clone repo -> fix code / create feature
 *   - run smoke test -> build
 *   - open a PR on GitHub
 *
 * Pattern: fire-and-forget via REST API — no @cursor/sdk needed
 * (Node 20 compatible, uses native fetch).
 */

const functions = require('firebase-functions/v1');

const CURSOR_API_BASE = 'https://api.cursor.com/v1';

// ── Intent detection: is this a code-action? ────────────────────────────
function isCodeAction(text) {
  const t = text.toLowerCase();
  const codePatterns = [
    /แก้โค้ด/, /แก้bug/, /แก้บั๊ก/, /fix code/, /fix bug/,
    /สร้างfeature/, /สร้างฟีเจอร์/, /add feature/, /add code/,
    /refactor/, /ปรับโครงสร้าง/, /rewrite/,
    /deploy/, /ดีพลอย/, /merge/,
    /ทำ pr/, /open pr/, /สร้าง pr/, /เปิด pr/,
    /ช่วยเขียน/, /implement/,
    /อัปเดตโค้ด/, /update code/,
  ];
  return codePatterns.some(p => p.test(t));
}

// ── Build a structured task prompt from natural language ─────────────────
function buildTaskPrompt(message, scope, history) {
  const scopeLabels = {
    tea: 'ร้านชินชา (Tea POS — apps/chincha-tea)',
    seafood: 'โกอ้วนซีฟู้ด (Shrimp POS — apps/seafood-pos)',
    webhook: 'LINE Bot / Webhook (apps/webhook-core)',
    scheduled: 'Scheduled / Automation (apps/webhook-core-scheduled)',
    root: 'ทั้งระบบ CHINCHA FLOW (apps/*)',
  };

  const recentContext = (history || []).slice(-3)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  return `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ของ CHINCHA FLOW monorepo
คุณกำลังรับคำสั่งจากพี่ (เจ้าของร้าน) ผ่าน AI Chat

=== REPO ===
GitHub: peachtukta1014/chinchaflow
Monorepo structure: apps/chincha-tea (ชา), apps/seafood-pos (กุ้ง), apps/webhook-core (Cloud Functions)
Firebase project: chincha-eeed6

=== กฎบังคับ (จาก AGENTS.md + peter-ser skill) ===
1. ก่อนเปิด PR ต้องรัน smoke test + build ให้ผ่าน
   - กุ้ง: node apps/seafood-pos/scripts/smoke-test.mjs && npm run build --workspace=seafood-pos
   - ชา: npm run build --workspace=chincha-tea
   - webhook-core: deploy-only, ไม่มี local server
2. ห้าม commit .env, .env.local, secrets
3. Commit message เป็นภาษาไทยหรืออังกฤษ ชัดเจน อธิบาย what + why
4. PR ไป main, draft ได้ก่อน
5. อย่า over-engineer — diff เล็ก, ใช้ convention เดิม
6. ถ้า smoke/build ไม่ผ่าน → แก้ก่อน merge, ห้ามข้าม

=== คำสั่งจากพี่ ===
Scope: ${scope} — ${scopeLabels[scope] || 'general'}
Message: ${message}

=== บริบทล่าสุด ===
${recentContext || '(ไม่มี)'}

=== สิ่งที่ต้องทำ ===
1. ทำความเข้าใจคำสั่ง ดูว่าไฟล์ไหนต้องแก้
2. แก้โค้ดตามคำสั่ง (ใช้ convention เดิม, diff เล็ก)
3. รัน smoke test + build ตาม scope
4. ถ้าผ่าน → commit + push branch + เปิด PR ไป main (draft ok)
5. ถ้าไม่ผ่าน → แก้แล้วรันใหม่
6. ตอบกลับเป็นภาษาไทยสั้นๆ: ทำอะไรไปบ้าง, PR URL, smoke/build ผ่านไหม`;
}

// ── Call Cursor Cloud REST API to spawn an agent ────────────────────────
async function spawnCursorAgent(apiKey, taskPrompt) {
  const res = await fetch(`${CURSOR_API_BASE}/agents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: { text: taskPrompt },
      model: { id: 'composer-2.5' },
      repos: [{ url: 'https://github.com/peachtukta1014/chinchaflow', startingRef: 'main' }],
      autoCreatePR: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => 'unknown');
    throw new Error(`Cursor API ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return {
    agentId: data.agentId || data.id,
    runId: data.runId || data.id,
    status: data.status,
  };
}

// ── Check agent status via REST API ──────────────────────────────────────
async function checkAgentStatus(apiKey, agentId) {
  const res = await fetch(`${CURSOR_API_BASE}/agents/${agentId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}`);
  }

  return await res.json();
}

// ── Direct handler for aiChatAgent.js to call without HTTP ───────────────
async function handleCodeAction({ message, history, scope }) {
  if (!isCodeAction(message)) {
    return {
      statusCode: 200,
      body: {
        reply: 'คำสั่งนี้ดูไม่ใช่การแก้โค้ด — ลองพิมพ์ให้ชัดขึ้น เช่น "เด๊ฟ ช่วยแก้บั๊ก..." หรือ "เด๊ฟ ช่วยสร้าง feature..."',
        scope: scope || 'root',
        intent: 'chat',
      },
    };
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error('handleCodeAction: CURSOR_API_KEY not set');
    return {
      statusCode: 500,
      body: {
        error: 'CURSOR_API_KEY ไม่ได้ตั้งค่า — แจ้งแอดมินให้เพิ่ม secret นี้ใน GitHub',
        scope: scope || 'root',
        intent: 'code-action',
        status: 'config_error',
      },
    };
  }

  const currentScope = scope || 'root';
  const taskPrompt = buildTaskPrompt(message, currentScope, history);

  try {
    const result = await spawnCursorAgent(apiKey, taskPrompt);

    console.log('handleCodeAction: spawned agent', result.agentId, 'run', result.runId);

    return {
      statusCode: 200,
      body: {
        reply: 'เริ่มทำงานแล้ว! เด๊ฟกำลัง:\n- Clone repo -> วิเคราะห์คำสั่ง -> แก้โค้ด\n- รัน smoke test + build\n- เปิด PR\n\nRun ID: ' + (result.runId || 'pending') + '\nAgent ID: ' + (result.agentId || 'pending') + '\n\nจะแจ้งผลเมื่อเสร็จ — อาจใช้เวลา 2-5 นาที',
        scope: currentScope,
        intent: 'code-action',
        status: 'started',
        runId: result.runId,
        agentId: result.agentId,
      },
    };
  } catch (err) {
    console.error('handleCodeAction error:', err);
    return {
      statusCode: 500,
      body: {
        reply: 'เกิดข้อผิดพลาด: ' + (err.message || 'unknown'),
        scope: currentScope,
        intent: 'code-action',
        status: 'error',
        error: err.message || 'unknown',
      },
    };
  }
}

// ── V1 onRequest — HTTP endpoint (called by aiChatAgentHttp) ─────────────
exports.aiWorkflowAgentHttp = functions
  .runWith({ memory: '512MB', timeoutSeconds: 60 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST เท่านั้น' });
      return;
    }

    const result = await handleCodeAction(req.body || {});
    res.status(result.statusCode).json(result.body);
  });

// ── Status poll endpoint — check on a running workflow ───────────────────
exports.aiWorkflowStatusHttp = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const { agentId } = (req.body || {});
    if (!agentId) {
      res.status(400).json({ error: 'ต้องส่ง agentId' });
      return;
    }

    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'CURSOR_API_KEY ไม่ได้ตั้งค่า' });
      return;
    }

    try {
      const info = await checkAgentStatus(apiKey, agentId);
      res.json({ agentId, status: info.status, info });
    } catch (err) {
      console.error('aiWorkflowStatusHttp error:', err);
      res.status(500).json({ error: err.message });
    }
  });

exports.handleCodeAction = handleCodeAction;
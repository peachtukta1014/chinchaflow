/**
 * AI Chat Agent (Flash) — Cloud Function for CHINCHA FLOW
 *
 * จีจี้ เลขาส่วนตัวพีช: เพื่อนคู่คิด รู้ใจ แนะนำ ตักเตือน
 *
 * แยก logic ออกเป็น flash/ modules:
 *   flash/flashContext.js   — Firestore loaders (project tree, docs, custom notes)
 *   flash/flashModels.js    — OpenRouter caller + model constants
 *   flash/flashPrompts.js   — System prompts + scope detection
 *   flash/flashTriggers.js  — Quick triggers, classifier, task brief builder
 *   flash/flashDispatch.js  — Pro Agent dispatch (repository_dispatch)
 *
 * Flash CF ไม่รู้จัก OPENROUTER_API_KEY_PRO — isolation จริง 100%
 */

const functions = require('firebase-functions/v1');
const { writeProgress, clearProgress, readProgress, writeResult, clearResult, writeTokenLog } = require('./shared/progressTracker');
const { loadProjectTree, loadCustomNotes, fetchJiijiDef, fetchChatAgentDocs, fetchCodeMetrics } = require('./flash/flashContext');
const { callOpenRouter, callOpenRouterForWebSearch } = require('./flash/flashModels');
const { SYSTEM_PROMPTS, detectScope } = require('./flash/flashPrompts');
const { detectQuickTrigger, isCodeMetricsQuery, classifyAndTranslate, buildTaskBrief } = require('./flash/flashTriggers');
const { dispatchToProAgent } = require('./flash/flashDispatch');

// ── Main HTTP endpoint (เส้นทางหลักเส้นทางเดียวที่ frontend ai-chat เรียกใช้จริง) ──
exports.aiChatAgentHttp = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // ── Progress polling endpoint: GET ?action=progress&requestId=xxx ────
    if (req.method === 'GET' && req.query.action === 'progress' && req.query.requestId) {
      const data = await readProgress(req.query.requestId);
      res.json(data);
      return;
    }

    // ── Deploy status endpoint: GET ?action=deploy_status ────────────────
    if (req.method === 'GET' && req.query.action === 'deploy_status') {
      const { readDeployStatus } = require('./deployNotify');
      const status = await readDeployStatus().catch(() => ({}));
      res.json(status);
      return;
    }

    // ── Result recovery endpoint: GET ?action=result&requestId=xxx ───────
    if (req.method === 'GET' && req.query.action === 'result' && req.query.requestId) {
      const data = await readResult(req.query.requestId);
      if (data) {
        await clearResult(req.query.requestId);
        res.json({ found: true, reply: data.reply, scope: data.scope });
      } else {
        res.json({ found: false });
      }
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'ใช้ POST เท่านั้น' });
      return;
    }

    const { message, history, scope, imageBase64, images, requestId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'ต้องมีข้อความ (message)' });
      return;
    }

    const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      res.status(500).json({ error: 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า' });
      return;
    }

    const currentScope = scope || 'root';
    const resolvedScope = detectScope(message, currentScope);

    // ── Code Metrics shortcut ────────────────────────────────────────────
    if (isCodeMetricsQuery(message)) {
      const metrics = await fetchCodeMetrics().catch(() => null);
      if (metrics) {
        res.json({ reply: `📊 **Code Metrics ล่าสุด**\n\n${metrics}`, scope: currentScope });
        return;
      }
      res.json({ reply: 'ยังไม่มีข้อมูล metrics ครับพี่ — ไปกด Run ที่ GitHub Actions → Code Metrics ก่อนนะคะ แล้วจีจี้จะอ่านได้เลย 🌸', scope: currentScope });
      return;
    }

    // ── Quick trigger: โอเคกุ้ง / โอเคชา ───────────────────────────────
    const quickTrigger = detectQuickTrigger(message);
    if (quickTrigger) {
      const label = quickTrigger.scope === 'seafood' ? '🦐 ร้านกุ้ง' : '🧋 ร้านชา';
      const taskId = requestId || `qt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ghPat = process.env.GH_PAT_DISPATCH || process.env.GH_PAT;
      if (!ghPat) {
        res.status(500).json({ reply: 'GH_PAT_DISPATCH และ GH_PAT ไม่ได้ตั้งค่า ส่งคำสั่งตรวจสุขภาพไม่ได้', scope: quickTrigger.scope });
        return;
      }
      try {
        await dispatchToProAgent(ghPat, {
          requestId: taskId,
          message: quickTrigger.task,
          history: [],
          scope: quickTrigger.scope,
          isHighRisk: false,
          confirmation: '',
        });
        await clearProgress(taskId);
        res.json({
          reply: `จีจี้ส่งงานตรวจสุขภาพ ${label} ไปแล้วนะคะ กำลังดำเนินการอยู่ครับพี่ 🌸`,
          status: 'processing',
          requestId: taskId,
          scope: quickTrigger.scope,
        });
      } catch (err) {
        console.error('quick trigger dispatch error:', err);
        res.status(500).json({ reply: `❌ ส่งคำสั่งไม่ได้ครับพี่: ${err.message}`, scope: quickTrigger.scope });
      }
      return;
    }

    // ── AI Intent Classifier ─────────────────────────────────────────────
    await writeProgress(requestId, 'กำลังวิเคราะห์คำสั่ง...');
    const classified = await classifyAndTranslate(apiKey, message, history, resolvedScope);
    const finalScope = classified.scope || resolvedScope;

    if (classified.intent === 'code-action') {
      if (classified.needsConfirmation) {
        const confirmMsg = classified.confirmationMessage ||
          `จีจี้เข้าใจแล้วนะครับ: ${classified.confirmation}\n\nถูกต้องไหมครับพี่? พิมพ์ "ทำเลย" ยืนยันได้เลย 🙂`;
        await clearProgress(requestId);
        res.json({ reply: confirmMsg, scope: finalScope, intent: 'pending-code-action' });
        return;
      }

      if (!requestId) {
        await clearProgress(requestId);
        res.status(400).json({ reply: 'ต้องมี requestId สำหรับ code-action ครับพี่', scope: finalScope });
        return;
      }

      const ghPatForDispatch = process.env.GH_PAT_DISPATCH || process.env.GH_PAT;
      if (!ghPatForDispatch) {
        await clearProgress(requestId);
        res.status(500).json({ reply: 'GH_PAT_DISPATCH และ GH_PAT ไม่ได้ตั้งค่า ส่งคำสั่งไม่ได้', scope: finalScope });
        return;
      }

      try {
        await dispatchToProAgent(ghPatForDispatch, {
          requestId,
          message: buildTaskBrief(classified, message),
          history: (history || []).slice(-10),
          scope: finalScope,
          isHighRisk: classified.isHighRisk !== false,
          confirmation: classified.confirmation || '',
        });
        await clearProgress(requestId);
        const prefix = classified.confirmation
          ? `จีจี้เข้าใจแล้วนะคะ: "${classified.confirmation}"\n\n`
          : '';
        res.json({
          reply: prefix + 'จีจี้รับงานแล้วนะคะ กำลังดำเนินการอยู่ครับพี่ — ติดตามความคืบหน้าได้เลย 🌸',
          status: 'processing',
          requestId,
          scope: finalScope,
          intent: 'code-action',
        });
        return;
      } catch (err) {
        console.error('aiChatAgentHttp: dispatch error:', err);
        await clearProgress(requestId);
        res.status(500).json({
          reply: `จีจี้ส่งคำสั่งไม่ได้ครับพี่ 🌸\n\n**สาเหตุ:** ${err.message || 'unknown'}`,
          scope: finalScope,
          intent: 'code-action',
          status: 'error',
        });
        return;
      }
    }

    // ── Chat mode: ตอบตรงจากบริบทที่มี ─────────────────────────────────
    const [agentDocs, jiijiDocs, projectTree, customNotes] = await Promise.all([
      fetchChatAgentDocs().catch(() => ''),
      fetchJiijiDef().catch(() => ''),
      loadProjectTree().catch(() => ''),
      loadCustomNotes().catch(() => ''),
    ]);
    const basePrompt = SYSTEM_PROMPTS[finalScope] || SYSTEM_PROMPTS.root;
    const webSearchInstruction = '\n\n---\n🔍 **Web Search Protocol:** ถ้าคำถามต้องการข้อมูลที่เปลี่ยนแปลงบ่อย (ราคาตลาดล่าสุด ข่าวล่าสุด เหตุการณ์ปัจจุบัน ข้อมูลที่ฐานความรู้ปัจจุบันไม่มี) ให้ตอบเฉพาะบรรทัดนี้แล้วหยุด: `[WEB_SEARCH: <query เป็นภาษาอังกฤษ>]` — ระบบจะค้นเว็บและส่งผลกลับมาให้ตอบใหม่ทันที ห้ามตอบอื่นเพิ่มในรอบนี้';
    const systemContent = basePrompt +
      (jiijiDocs ? '\n\n---\n## 🤖 JIIJI.md (ตัวตนและความสามารถของจีจี้)\n' + jiijiDocs : '') +
      (agentDocs ? '\n\n---\n## 📋 กฎและสไตล์การทำงาน (โหลดจาก repo)\n' + agentDocs : '') +
      (projectTree ? '\n\n---\n## 🗂️ โครงสร้างโปรเจกต์ปัจจุบัน (sync จาก repo อัตโนมัติ)\n' + projectTree : '') +
      (customNotes ? '\n\n---\n## 📝 Custom Skills / Notes (พีชตั้งค่าเอง)\n' + customNotes : '') +
      webSearchInstruction;

    const messages = [
      { role: 'system', content: systemContent },
      ...(history || []).slice(-20),
      { role: 'user', content: message },
    ];

    try {
      const result = await callOpenRouter(apiKey, messages, { imageBase64: imageBase64 || null, images: images || null, userText: message });
      const { text: reply, usage } = result;
      const hasImages = imageBase64 || (images && images.length > 0);
      const tokenEntry = hasImages ? { vision: usage } : { flash: usage };
      await writeTokenLog(requestId, tokenEntry).catch(() => {});

      // ── Web search two-model flow ─────────────────────────────────────
      const WEB_SEARCH_RE = /^\[WEB_SEARCH:\s*(.+?)\]/i;
      const wsMatch = !hasImages && reply.match(WEB_SEARCH_RE);
      if (wsMatch) {
        const searchQuery = wsMatch[1].trim();
        await writeProgress(requestId, `กำลังค้นหาข้อมูลจากเว็บ: "${searchQuery}"...`);
        let wsText = '';
        try {
          const wsResult = await callOpenRouterForWebSearch(apiKey, searchQuery);
          wsText = wsResult.text;
          await writeTokenLog(requestId, { search: wsResult.usage }).catch(() => {});
        } catch (wsErr) {
          console.error('web search failed — continuing without results:', wsErr.message);
        }
        const messagesWithWeb = [
          ...messages,
          { role: 'assistant', content: reply },
          {
            role: 'user',
            content: wsText
              ? `ผลการค้นหาจากเว็บ (query: "${searchQuery}"):\n\n${wsText}\n\nตอบคำถามเดิมของพี่พีชโดยใช้ข้อมูลนี้ได้เลยครับ`
              : `ค้นเว็บไม่ได้ขณะนี้ กรุณาตอบจากความรู้ที่มีแทนครับ`,
          },
        ];
        const result2 = await callOpenRouter(apiKey, messagesWithWeb, { userText: message });
        const { text: finalReply, usage: usage2 } = result2;
        await writeTokenLog(requestId, { flash: usage2 }).catch(() => {});
        await writeResult(requestId, { reply: finalReply, scope: finalScope });
        res.json({ reply: finalReply, scope: finalScope });
        return;
      }
      // ────────────────────────────────────────────────────────────────

      await writeResult(requestId, { reply, scope: finalScope });
      res.json({ reply, scope: finalScope });
    } catch (err) {
      console.error('aiChatAgentHttp error:', err);
      res.status(500).json({
        reply: `จีจี้ตอบไม่ได้ตอนนี้ครับพี่ 🌸\n\nAI Error: ${err.message}\n\nลองส่งใหม่อีกครั้งนะคะ`,
        error: err.message,
        scope: finalScope,
      });
    }
  });

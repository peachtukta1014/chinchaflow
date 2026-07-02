/**
 * AI Chat Agent (Flash) — Cloud Function for CHINCHA FLOW
 *
 * จีจี้ เลขาส่วนตัวพีช: เพื่อนคู่คิด รู้ใจ แนะนำ ตักเตือน
 *
 * แยก logic ออกเป็น flash/ modules:
 *   flash/flashContext.js      — Firestore loaders (project tree, docs, custom notes)
 *   flash/flashModels.js       — OpenRouter caller + model constants
 *   flash/flashPrompts.js      — System prompts + scope detection
 *   flash/flashTriggers.js     — Quick triggers, classifier, task brief builder
 *   flash/flashAnalysisLoop.js — Code analysis loop (read-only) ก่อนสรุป Task Brief
 *   flash/flashDispatch.js     — Pro Agent dispatch (repository_dispatch)
 *
 * Flash CF ไม่รู้จัก OPENROUTER_API_KEY_PRO — isolation จริง 100%
 */

const functions = require('firebase-functions/v1');
const { writeProgress, clearProgress, readProgress, writeResult, clearResult, writeTokenLog } = require('./shared/progressTracker');
const { loadProjectTree, loadCustomNotes, fetchJiijiDef, fetchChatAgentDocs, fetchCodeMetrics, savePendingAction, loadPendingAction, clearPendingAction, loadLastExecutionStatus } = require('./flash/flashContext');
const { callOpenRouter, callOpenRouterForWebSearch } = require('./flash/flashModels');
const { SYSTEM_PROMPTS, detectScope } = require('./flash/flashPrompts');
const { detectQuickTrigger, isCodeMetricsQuery, classifyAndTranslate, buildTaskBrief } = require('./flash/flashTriggers');
const { runFlashAnalysisLoop } = require('./flash/flashAnalysisLoop');
const { matchWebSearchQuery, stripWebSearchTags } = require('./flash/webSearchTag');
const { dispatchToProAgent } = require('./flash/flashDispatch');

const LAST_RUN_STALE_MS = 6 * 60 * 60 * 1000; // 6 ชั่วโมง — เกินนี้ถือว่าเก่าเกินจะเอามาปนกับงานปัจจุบัน

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
        res.json({ found: true, reply: data.reply, scope: data.scope });
        clearResult(req.query.requestId).catch(() => {}); // cleanup หลัง respond ป้องกัน brief หายถ้า client หลุด
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

    // ── "ไฟเขียว" — พีชยืนยันส่งงาน Pro จาก pending brief ──────────────
    if (/ไฟเขียว/.test(message)) {
      const pendingId = req.body.pendingRequestId;
      if (pendingId) {
        const pending = await loadPendingAction(pendingId);
        if (pending) {
          if (!requestId) {
            res.status(400).json({ reply: 'ต้องมี requestId สำหรับ code-action ครับพี่', scope: pending.scope });
            return;
          }
          const ghPatForDispatch = (process.env.GH_PAT_DISPATCH || '').trim();
          if (!ghPatForDispatch) {
            res.status(500).json({ reply: 'GH_PAT_DISPATCH ไม่ได้ตั้งค่า ส่งคำสั่งไม่ได้', scope: pending.scope });
            return;
          }
          try {
            await dispatchToProAgent(ghPatForDispatch, {
              requestId,
              message: pending.taskBrief,
              history: [],
              scope: pending.scope,
              isHighRisk: pending.isHighRisk !== false,
              confirmation: pending.confirmation || '',
            });
            await clearPendingAction(pendingId); // ลบหลัง dispatch สำเร็จ — ถ้า dispatch fail brief ยังอยู่ retry ได้
            await writeProgress(requestId, 'ส่งงานเข้าคิวแล้ว กำลังปลุก V4-Pro...');
            res.json({
              reply: 'จีจี้ส่งงานให้ V4-Pro แล้วครับพี่ 🌸 ติดตามความคืบหน้าได้เลย',
              status: 'processing',
              requestId,
              scope: pending.scope,
              intent: 'code-action',
            });
          } catch (err) {
            console.error('ไฟเขียว dispatch error:', err);
            await clearProgress(requestId);
            // pendingId ยังอยู่ → พีชพิมพ์ "ไฟเขียว" ซ้ำได้ทันที
            res.status(500).json({
              reply: `จีจี้ส่งคำสั่งไม่ได้ครับพี่ 🌸\n\n**สาเหตุ:** ${err.message || 'unknown'}\n\n💡 พิมพ์ "ไฟเขียว" อีกครั้งได้เลยนะคะ`,
              scope: pending.scope,
              status: 'error',
            });
          }
          return;
        }
      }
      // ไม่มี pending → ตกลง flow ปกติ (อาจเป็นการพูดถึง "ไฟเขียว" ในบริบทอื่น)
    }

    // ── Quick trigger: โอเคกุ้ง / โอเคชา ───────────────────────────────
    const quickTrigger = detectQuickTrigger(message);
    if (quickTrigger) {
      const label = quickTrigger.scope === 'seafood' ? '🦐 ร้านกุ้ง' : '🧋 ร้านชา';
      const taskId = requestId || `qt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ghPat = (process.env.GH_PAT_DISPATCH || '').trim();
      if (!ghPat) {
        res.status(500).json({ reply: 'GH_PAT_DISPATCH ไม่ได้ตั้งค่า ส่งคำสั่งตรวจสุขภาพไม่ได้', scope: quickTrigger.scope });
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
        await writeProgress(taskId, 'ส่งงานเข้าคิวแล้ว กำลังปลุก Pro Agent...');
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

    // เช็ก scope-level error pointer จากรอบก่อน (loadLastExecutionStatus) — ส่งเข้า classifier
    // เฉพาะกรณีล้มเหลวและยังไม่เก่าเกินไป (กัน error เก่าข้ามวันมาปนกับงานคนละเรื่อง)
    const rawLastRun = await loadLastExecutionStatus(resolvedScope).catch(() => null);
    const lastRunStatus = (rawLastRun?.status === 'error' && Date.now() - (rawLastRun.updatedAt || 0) < LAST_RUN_STALE_MS)
      ? rawLastRun
      : null;

    const classified = await classifyAndTranslate(apiKey, message, history, resolvedScope, lastRunStatus);
    const finalScope = classified.scope || resolvedScope;

    if (classified.intent === 'code-action') {
      if (!requestId) {
        await clearProgress(requestId);
        res.status(400).json({ reply: 'ต้องมี requestId สำหรับ code-action ครับพี่', scope: finalScope });
        return;
      }

      // ── Flash Code Analysis Loop — อ่านโค้ดจริงก่อนสรุป Task Brief (ไม่ใช่แค่เดา) ──
      // classified.taskSpec = แนวทางเบื้องต้นจากบทสนทนาเท่านั้น (ยังไม่ยืนยันกับโค้ดจริง)
      // ผูก GH_PAT_READ (read-only) เท่านั้น — non-blocking: error/หมดรอบ/ไม่มี key → fallback ไปใช้ taskSpec เดิม
      const ghPatRead = (process.env.GH_PAT_READ || '').trim();
      let finalTaskSpec = classified.taskSpec || {};
      let analysisNote = '';

      if (ghPatRead) {
        try {
          const projectTreeForLoop = await loadProjectTree().catch(() => '');
          await writeProgress(requestId, 'จีจี้กำลังอ่านโค้ดก่อนสรุปงาน...');
          const analyzed = await runFlashAnalysisLoop(apiKey, ghPatRead, {
            message,
            history,
            scope: finalScope,
            initialTaskSpec: classified.taskSpec,
            projectTree: projectTreeForLoop,
            requestId,
          });
          if (analyzed?.taskSpec) {
            finalTaskSpec = analyzed.taskSpec;
          } else {
            analysisNote = '\n\n⚠️ จีจี้อ่านโค้ดไม่ทันครบ (เกินรอบวิเคราะห์) — Task Brief นี้อ้างอิงจากแนวทางเบื้องต้นเท่านั้น Pro ควร list_files/read_file ตรวจซ้ำก่อนแก้';
          }
        } catch (err) {
          console.error('runFlashAnalysisLoop failed — fallback ไปใช้ taskSpec เบื้องต้น:', err.message);
          analysisNote = '\n\n⚠️ จีจี้อ่านโค้ดไม่สำเร็จ (error ระหว่างวิเคราะห์) — Task Brief นี้อ้างอิงจากแนวทางเบื้องต้นเท่านั้น Pro ควร list_files/read_file ตรวจซ้ำก่อนแก้';
        }
      } else {
        analysisNote = '\n\n⚠️ GH_PAT_READ ไม่ได้ตั้งค่า — Task Brief นี้อ้างอิงจากแนวทางเบื้องต้นเท่านั้น ไม่ได้อ่านโค้ดจริง';
      }

      const finalIsHighRisk = finalTaskSpec.isHighRisk !== undefined ? finalTaskSpec.isHighRisk !== false : classified.isHighRisk !== false;
      const taskBrief = buildTaskBrief({ taskSpec: finalTaskSpec }, message) + analysisNote;

      // บันทึก Task Brief รอพีชพิมพ์ "ไฟเขียว"
      await savePendingAction(requestId, {
        taskBrief,
        scope: finalScope,
        isHighRisk: finalIsHighRisk,
        confirmation: finalTaskSpec.description || classified.confirmation || '',
      });

      await clearProgress(requestId);

      const filePreview = finalTaskSpec.files_hint?.[0];
      const confirmMsg = `📋 จีจี้อ่านโค้ดแล้วนะครับพี่ 🌸\n\n` +
        `🎯 งาน: ${finalTaskSpec.description || classified.confirmation || 'วิเคราะห์งานเสร็จแล้ว'}\n` +
        (finalTaskSpec.target_behavior ? `▸ ผลลัพธ์: ${finalTaskSpec.target_behavior}\n` : '') +
        (filePreview?.path ? `📁 ไฟล์: \`${filePreview.path}\`${filePreview.fn ? ' → ' + filePreview.fn : ''}\n` : '') +
        `⚠️ Risk: ${finalIsHighRisk ? 'high' : 'low'}${finalTaskSpec.risk_reason ? ' — ' + finalTaskSpec.risk_reason : ''}` +
        analysisNote +
        `\n\nพิมพ์ "ไฟเขียว" เพื่อส่งงานให้ V4-Pro ได้เลยครับ 🟢`;

      res.json({
        reply: confirmMsg,
        scope: finalScope,
        intent: 'pending-code-action',
        pendingRequestId: requestId,
      });
      return;
    }

    // ── Chat mode: ตอบตรงจากบริบทที่มี ─────────────────────────────────
    const [agentDocs, jiijiDocs, projectTree, customNotes] = await Promise.all([
      fetchChatAgentDocs().catch(() => ''),
      fetchJiijiDef().catch(() => ''),
      loadProjectTree().catch(() => ''),
      loadCustomNotes().catch(() => ''),
    ]);
    const basePrompt = SYSTEM_PROMPTS[finalScope] || SYSTEM_PROMPTS.root;
    const webSearchInstruction = '\n\n---\n🔍 **Web Search Protocol:** ถ้าคำถามต้องการข้อมูลที่เปลี่ยนแปลงบ่อย (ราคาตลาดล่าสุด ข่าวล่าสุด เหตุการณ์ปัจจุบัน ข้อมูลที่ฐานความรู้ปัจจุบันไม่มี) ให้ตอบเฉพาะบรรทัดนี้แล้วหยุด: `[WEB_SEARCH: <query เป็นภาษาอังกฤษ>]` — ระบบจะค้นเว็บและส่งผลกลับมาให้ตอบใหม่ทันที ห้ามตอบอื่นเพิ่มในรอบนี้' +
      '\n\n⚠️ **ข้อห้ามสำคัญ:** โหมดแชทนี้อ่านไฟล์/โค้ดใน repo ไม่ได้ — ห้ามอ้างหรือแสดงท่าทีว่า "กำลังอ่านไฟล์", "ขออ่านโค้ดก่อน", "เปิด Code Analysis Loop" เด็ดขาด (การอ่านโค้ดจริงเกิดเฉพาะงาน code-action ที่ระบบจัดให้เอง) ถ้าพี่พีชรายงานปัญหาที่ต้องดูโค้ดจริง ให้ตอบตรงๆ ว่าจีจี้จะจัดเป็นงานตรวจโค้ด แล้วให้พี่พีชพิมพ์สั่งงานนั้นชัดๆ เช่น "ตรวจสอบและแก้ ..." — ห้ามเดาคำตอบแทนการดูโค้ด';
    const systemContent = basePrompt +
      (jiijiDocs ? '\n\n---\n## 🤖 FLASH.md (ตัวตนและความสามารถของจีจี้)\n' + jiijiDocs : '') +
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
      // logic จับ/ลบแท็กแยกไว้ที่ flash/webSearchTag.js เพื่อให้เทสได้ (test-web-search-tag.js)
      const searchQuery = !hasImages ? matchWebSearchQuery(reply) : null;
      if (searchQuery) {
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
        const { usage: usage2 } = result2;
        const finalReply = stripWebSearchTags(result2.text) || result2.text;
        await writeTokenLog(requestId, { flash: usage2 }).catch(() => {});
        await writeResult(requestId, { reply: finalReply, scope: finalScope });
        res.json({ reply: finalReply, scope: finalScope });
        return;
      }
      // ────────────────────────────────────────────────────────────────

      // strip แท็กที่อาจหลุดมาในเส้นทางที่ไม่ได้เข้า ws flow (เช่น มีรูปแนบ)
      const cleanReply = stripWebSearchTags(reply) || reply;
      await writeResult(requestId, { reply: cleanReply, scope: finalScope });
      res.json({ reply: cleanReply, scope: finalScope });
    } catch (err) {
      console.error('aiChatAgentHttp error:', err);
      res.status(500).json({
        reply: `จีจี้ตอบไม่ได้ตอนนี้ครับพี่ 🌸\n\nAI Error: ${err.message}\n\nลองส่งใหม่อีกครั้งนะคะ`,
        error: err.message,
        scope: finalScope,
      });
    }
  });

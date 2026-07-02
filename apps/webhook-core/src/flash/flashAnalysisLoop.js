/**
 * flashAnalysisLoop.js — Flash Code Analysis Loop (read-only agentic loop)
 *
 * เดิม Flash ("Technical Translator") เดา files_hint/target_behavior/logic_constraints
 * จากบทสนทนาอย่างเดียว แล้วแค่ "เช็กว่า path มีอยู่จริงไหม" ก่อนส่งให้ Pro (ไม่เคยอ่านเนื้อโค้ดจริง)
 * → Pro ต้องมาแก้ตามความเข้าใจที่ผิดเองอีกที เสีย iteration
 *
 * โมดูลนี้ให้ Flash เรียก tool อ่านโค้ดจริง (read-only, ผูก GH_PAT_READ เท่านั้น — ห้าม write)
 * ก่อนสรุป Task Brief สุดท้าย เพื่อให้ "ยิงคำสั่ง" ด้วยความเข้าใจจริง ไม่ใช่การเดา
 *
 * ต่างจาก Pro (agentTools.js) ตรงที่:
 * - ไม่มี patch_file/write_file/commit_and_pr/trigger_deploy/exec_command — read-only ล้วน
 * - MAX_ITERATIONS ต่ำกว่ามาก (สำรวจเบื้องต้น ไม่ใช่แก้โค้ดจริง)
 * - จบด้วย tool `finalize_task_brief` เสมอ (ระบบกำหนด ไม่ใช่อนุมานจาก finish_reason)
 * - non-blocking เสมอ: error/หมดรอบ → คืน null ให้ caller fallback ไปใช้ taskSpec ที่เดาไว้ตอนแรก
 */

const { OPENROUTER_BASE, FLASH_MODEL } = require('./flashModels');
const { fetchRepoFiles } = require('./flashContext');
const { writeProgress } = require('../shared/progressTracker');

const FLASH_ANALYSIS_MODEL = process.env.FLASH_MODEL || FLASH_MODEL;
const MAX_ITERATIONS = 8; // เพิ่มจาก 6 → 8 เพื่อให้สะสมข้อมูลได้มากขึ้นก่อนสรุป (8×60s = 480s < function timeout 540s)
const MIN_FILES_BEFORE_FINALIZE = 2; // ต้องอ่านอย่างน้อย 2 ไฟล์ก่อน finalize ได้
const EXPLORE_ONLY_ROUNDS = 3; // 3 รอบแรกไม่มี finalize_task_brief ใน tool list — บังคับอ่านโค้ด
const CALL_TIMEOUT_MS = 60 * 1000; // 1 นาทีต่อรอบ — งานอ่าน/ค้นสั้นกว่า Pro มาก

// tools แบ่ง 2 ชุด: READ_ONLY (รอบแรกๆ บังคับอ่าน) กับ ALL (รอบหลังๆ finalize ได้)
const READ_ONLY_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'อ่านเนื้อไฟล์จาก GitHub repo (read-only, สูงสุด 3,000 ตัวอักษรแรก)',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'path ไฟล์ relative จาก repo root เช่น apps/seafood-pos/src/App.jsx' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'ดู project tree ปัจจุบัน (sync จาก repo อัตโนมัติ) — ใส่ dir เพื่อกรองเฉพาะบรรทัดที่เกี่ยวข้อง',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'คำค้นกรองบรรทัด เช่น "seafood-pos/src/lib" (ไม่ใส่ = ดูทั้งหมด)' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'ค้นหา string pattern ในไฟล์ที่ระบุ (สูงสุด 5 ไฟล์ต่อครั้ง) — ใช้เช็คว่า function/ตัวแปรถูกเรียกใช้ที่ไหนบ้าง เพื่อดูความเชื่อมโยงข้ามไฟล์',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'ข้อความที่จะค้นหา' },
          files: { type: 'array', items: { type: 'string' }, description: 'path ไฟล์ที่จะค้น (สูงสุด 5 ไฟล์)' },
        },
        required: ['pattern', 'files'],
      },
    },
  },
];

const FINALIZE_TOOL = {
  type: 'function',
  function: {
    name: 'finalize_task_brief',
    description: `เรียกเมื่ออ่าน/วิเคราะห์โค้ดพอแล้วเท่านั้น (ต้อง read_file มาแล้วอย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์) เพื่อสรุปเป็น Task Brief ที่แม่นยำสำหรับส่งให้ Pro Agent ไปแก้`,
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '1 ประโยค: แก้/เพิ่มอะไร ที่ function/component ไหน — ระบุชื่อเจาะจงจากโค้ดที่อ่านจริง' },
        target_behavior: { type: 'string', description: 'พฤติกรรมสุดท้ายที่ระบบต้องทำ มุม user/system' },
        logic_constraints: { type: 'array', items: { type: 'string' }, description: 'invariant ที่ห้ามละเมิด เจาะจงถึงระดับ function ที่อ่านเจอจริง' },
        files_hint: {
          type: 'array',
          items: {
            type: 'object',
            properties: { path: { type: 'string' }, fn: { type: 'string' } },
            required: ['path'],
          },
          description: 'ไฟล์ที่ยืนยันแล้วว่ามีอยู่จริง (จาก read_file/list_files เท่านั้น) เรียงจากไฟล์หลักที่ต้องแก้ก่อน',
        },
        diff_expectation: { type: 'string', description: '1-2 ประโยค: จะเปลี่ยนอะไรในโค้ด ระดับ logic/ค่า/condition' },
        isHighRisk: { type: 'boolean', description: 'true ถ้ากระทบ ราคา/VAT/FIFO/lineOrders/auth/Firestore schema/flow POS หลัก/แก้ >3 ไฟล์' },
        risk_reason: { type: 'string', description: '1 ประโยคสั้นๆ อธิบายว่าทำไมถึงประเมินความเสี่ยงระดับนี้' },
      },
      required: ['description', 'target_behavior', 'files_hint', 'isHighRisk'],
    },
  },
};

const FLASH_ANALYSIS_TOOLS = [...READ_ONLY_TOOLS, FINALIZE_TOOL];

async function callFlashWithTools(apiKey, messages, forceToolUse, tools) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chincha-flow.web.app',
        'X-Title': 'CHINCHA FLOW Flash Analysis',
      },
      body: JSON.stringify({
        model: FLASH_ANALYSIS_MODEL,
        messages,
        tools: tools || FLASH_ANALYSIS_TOOLS,
        tool_choice: typeof forceToolUse === 'string'
          ? { type: 'function', function: { name: forceToolUse } }
          : (forceToolUse ? 'required' : 'auto'),
        temperature: 0.1,
        max_tokens: 3072,
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Flash analysis timeout (>1 นาทีต่อรอบ)');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice) throw new Error('OpenRouter ไม่ตอบกลับ');
  return choice;
}

async function executeFlashTool(name, args, { ghPatRead, projectTree }) {
  switch (name) {
    case 'read_file': {
      if (!args.path) return '❌ ต้องระบุ path';
      const found = await fetchRepoFiles(ghPatRead, [args.path]);
      const content = found[args.path];
      if (!content) return `❌ ไม่พบไฟล์: ${args.path}`;
      return `=== ${args.path} ===\n${content}`;
    }
    case 'list_files': {
      if (!projectTree) return '❌ ไม่มี project tree ใน Firestore ตอนนี้ (systemConfig/projectTree ว่าง)';
      if (!args.dir) return projectTree.slice(0, 4000);
      const needle = args.dir.toLowerCase();
      const lines = projectTree.split('\n').filter(l => l.toLowerCase().includes(needle));
      return lines.length > 0
        ? lines.slice(0, 120).join('\n')
        : `ไม่พบบรรทัดที่มีคำว่า "${args.dir}" ใน project tree`;
    }
    case 'search_code': {
      const files = Array.isArray(args.files) ? args.files.slice(0, 5) : [];
      if (!args.pattern || files.length === 0) return '❌ ต้องระบุ pattern และ files';
      const found = await fetchRepoFiles(ghPatRead, files);
      const results = [];
      for (const f of files) {
        const content = found[f];
        if (!content) continue;
        const lines = content.split('\n');
        const matches = lines
          .map((text, i) => ({ line: i + 1, text }))
          .filter(m => m.text.includes(args.pattern));
        if (matches.length > 0) {
          results.push(`=== ${f} ===`);
          matches.slice(0, 5).forEach(m => results.push(`  บรรทัด ${m.line}: ${m.text.trim()}`));
        }
      }
      return results.length > 0
        ? `พบ "${args.pattern}":\n${results.join('\n')}`
        : `ไม่พบ "${args.pattern}" (หมายเหตุ: ค้นได้แค่ 3,000 ตัวอักษรแรกของแต่ละไฟล์)`;
    }
    default:
      return `❌ ไม่รู้จัก tool "${name}"`;
  }
}

/**
 * วนอ่าน/ค้นโค้ดจริงก่อนสรุป taskSpec — คืน { taskSpec, iterations } เมื่อเรียก finalize_task_brief สำเร็จ
 * คืน null เมื่อ: ไม่มี ghPatRead, เกิน MAX_ITERATIONS, หรือ error ระหว่างทาง (caller ต้อง fallback เอง)
 */
async function runFlashAnalysisLoop(apiKey, ghPatRead, { message, history, scope, initialTaskSpec, projectTree, requestId }) {
  if (!ghPatRead) return null; // non-blocking — caller ใช้ taskSpec ที่เดาไว้แทน

  const systemPrompt = `คุณคือจีจี้ — Technical Translator ของ CHINCHA FLOW กำลังวิเคราะห์คำสั่ง "code-action" ของพี่พีช
**ก่อนสรุปงานให้ Pro Agent ไปแก้ ต้องอ่านโค้ดจริงให้เพียงพอก่อนเสมอ ห้ามเดา** — ใช้ read_file/list_files/search_code สำรวจไฟล์ที่เกี่ยวข้องจนเข้าใจว่าโค้ดเชื่อมโยงกันยังไง

scope ปัจจุบัน: ${scope || 'root'}
แนวทางเบื้องต้นจากบทสนทนา (ยังไม่ยืนยัน ต้องอ่านโค้ดตรวจก่อน): ${JSON.stringify(initialTaskSpec || {}).slice(0, 800)}

วิธีทำงาน (สะสมข้อมูลก่อนสรุป):
1. **ดูโครงสร้างก่อน** — เรียก list_files เพื่อดูว่าไฟล์ไหนเกี่ยวข้องกับปัญหา
2. **อ่านไฟล์หลัก** — read_file ไฟล์ที่น่าจะเป็นต้นเหตุ อ่านให้ครบทุกไฟล์ที่เกี่ยวข้อง (อย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์)
3. **ตามหาความเชื่อมโยง** — search_code ดูว่า function/component ที่เกี่ยวข้องถูกเรียกจากที่ไหนอีก แล้ว read_file ไฟล์ต้นทางด้วย
4. **สรุปเมื่อมีข้อมูลพอ** — เรียก finalize_task_brief เมื่อเข้าใจ root cause + ไฟล์ที่ต้องแก้ครบแล้วเท่านั้น

กฎเหล็ก:
1. ต้องเรียก read_file อย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์ก่อน finalize_task_brief (ห้าม finalize จากการอ่านแค่ไฟล์เดียว)
2. files_hint สุดท้ายต้องเป็น path ที่ยืนยันแล้วว่ามีอยู่จริงจาก read_file/list_files เท่านั้น
3. ตอบเป็นการเรียก tool เท่านั้นทุกรอบ ห้ามพิมพ์ข้อความเปล่าอธิบายแผนแล้วไม่เรียก tool
4. รอบ 1-${EXPLORE_ONLY_ROUNDS} ให้อ่าน/ค้นอย่างเดียว (finalize ยังไม่พร้อม) — ใช้เวลานี้สะสมข้อมูลให้มากที่สุด
5. มีเวลาจำกัด ${MAX_ITERATIONS} รอบ — อย่ารีบสรุป ใช้รอบที่มีอ่านโค้ดให้ครบก่อน`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-6),
    { role: 'user', content: message },
  ];

  let filesRead = 0;
  const filesReadList = []; // ติดตามรายชื่อไฟล์ที่อ่านแล้ว เพื่อรายงาน knowledge ให้ model

  for (let iterations = 1; iterations <= MAX_ITERATIONS; iterations++) {
    // Phase 1 (รอบ 1-EXPLORE_ONLY_ROUNDS): เฉพาะ read/list/search — ไม่มี finalize ใน tool list
    // Phase 2 (รอบ EXPLORE_ONLY_ROUNDS+1 ขึ้นไป): เพิ่ม finalize_task_brief เข้ามา
    const isExplorePhase = iterations <= EXPLORE_ONLY_ROUNDS;
    const iterTools = isExplorePhase ? READ_ONLY_TOOLS : FLASH_ANALYSIS_TOOLS;

    const phaseLabel = isExplorePhase
      ? `จีจี้กำลังสำรวจโค้ด... (รอบ ${iterations}/${MAX_ITERATIONS} — อ่านแล้ว ${filesRead} ไฟล์)`
      : `จีจี้กำลังวิเคราะห์โค้ด... (รอบ ${iterations}/${MAX_ITERATIONS} — อ่านแล้ว ${filesRead} ไฟล์)`;
    await writeProgress(requestId, phaseLabel, 'flash');

    const choice = await callFlashWithTools(apiKey, messages, true, iterTools);
    const am = choice.message;
    messages.push({ role: 'assistant', content: am.content || null, tool_calls: am.tool_calls || undefined });

    if (!am.tool_calls || am.tool_calls.length === 0) {
      messages.push({
        role: 'user',
        content: '⚠️ ต้องเรียก tool เท่านั้น (read_file / list_files / search_code) ห้ามพิมพ์ข้อความเปล่า — ยังต้องอ่านโค้ดเพิ่มอีก',
      });
      continue;
    }

    for (const toolCall of am.tool_calls) {
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* use empty */ }

      if (toolCall.function.name === 'finalize_task_brief') {
        if (filesRead < MIN_FILES_BEFORE_FINALIZE) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `❌ อ่านไปแค่ ${filesRead} ไฟล์ — ต้อง read_file อย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์ก่อน finalize (อ่านไฟล์ที่เกี่ยวข้องเพิ่มก่อน)`,
          });
          continue;
        }
        return { taskSpec: args, iterations };
      }

      if (toolCall.function.name === 'read_file') {
        filesRead++;
        if (args.path) filesReadList.push(args.path);
      }
      const toolLabel = ({
        read_file: `จีจี้กำลังอ่าน ${args.path || 'ไฟล์'}...`,
        list_files: `จีจี้กำลังไล่ดูโครงสร้าง ${args.dir || 'repo'}...`,
        search_code: `จีจี้กำลังค้นหา "${args.pattern || ''}" ในโค้ด...`,
      })[toolCall.function.name];
      if (toolLabel) await writeProgress(requestId, toolLabel, 'flash');
      const resultText = await executeFlashTool(toolCall.function.name, args, { ghPatRead, projectTree });
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
    }

    // Knowledge tracker: บอก model ว่าอ่านอะไรไปแล้วบ้าง + กระตุ้นให้อ่านเพิ่มถ้ายังไม่พอ
    if (isExplorePhase && filesRead > 0) {
      messages.push({
        role: 'user',
        content: `📊 สรุปความรู้รอบนี้: อ่านแล้ว ${filesRead} ไฟล์ [${filesReadList.join(', ')}] — ยังอยู่ช่วงสำรวจ (รอบ ${iterations}/${EXPLORE_ONLY_ROUNDS}) ค้นหาไฟล์ที่เกี่ยวข้องเพิ่มเติมได้อีก เช่น ไฟล์ที่ import/เรียกใช้ function ที่เจอ หรือ search_code หาการเชื่อมโยง`,
      });
    }
  }

  // ครบรอบแล้วยังไม่ finalize — บังคับสรุปจากสิ่งที่อ่านมา แทนการทิ้ง context ทั้งหมด
  if (filesRead >= MIN_FILES_BEFORE_FINALIZE) {
    try {
      messages.push({
        role: 'user',
        content: `⚠️ ครบรอบวิเคราะห์แล้ว (อ่านแล้ว ${filesRead} ไฟล์: ${filesReadList.join(', ')}) — เรียก finalize_task_brief ตอนนี้ทันที สรุป taskSpec จากไฟล์ที่อ่านไปแล้วทั้งหมด ห้ามอ่านเพิ่ม`,
      });
      const finalChoice = await callFlashWithTools(apiKey, messages, 'finalize_task_brief');
      const tc = (finalChoice.message?.tool_calls || [])[0];
      if (tc?.function?.name === 'finalize_task_brief') {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* use empty */ }
        if (args.description && args.target_behavior) {
          return { taskSpec: args, iterations: MAX_ITERATIONS + 1, forcedFinalize: true };
        }
      }
    } catch (err) {
      console.warn('force finalize หลังครบรอบล้มเหลว — fallback ไป initialTaskSpec:', err.message);
    }
  }
  return null; // อ่านไฟล์ไม่ถึง MIN_FILES_BEFORE_FINALIZE หรือ force finalize พัง — caller fallback ไป initialTaskSpec
}

module.exports = { runFlashAnalysisLoop, FLASH_ANALYSIS_TOOLS, READ_ONLY_TOOLS, MAX_ITERATIONS, MIN_FILES_BEFORE_FINALIZE, EXPLORE_ONLY_ROUNDS };

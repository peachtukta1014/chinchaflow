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
const MAX_ITERATIONS = 6; // สำรวจเบื้องต้นเท่านั้น — ไม่ใช่แก้โค้ด ไม่ต้องเผื่อรอบเยอะแบบ Pro
const CALL_TIMEOUT_MS = 60 * 1000; // 1 นาทีต่อรอบ — งานอ่าน/ค้นสั้นกว่า Pro มาก

const FLASH_ANALYSIS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'อ่านเนื้อไฟล์จาก GitHub repo (read-only, สูงสุด 3,000 ตัวอักษรแรก) — ต้องเรียกอย่างน้อย 1 ครั้งก่อน finalize_task_brief เสมอ',
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
  {
    type: 'function',
    function: {
      name: 'finalize_task_brief',
      description: 'เรียกเมื่ออ่าน/วิเคราะห์โค้ดพอแล้วเท่านั้น เพื่อสรุปเป็น Task Brief ที่แม่นยำสำหรับส่งให้ Pro Agent ไปแก้ — ต้อง read_file มาแล้วอย่างน้อย 1 ไฟล์ก่อนเรียก tool นี้',
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
  },
];

async function callFlashWithTools(apiKey, messages, forceToolUse) {
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
        tools: FLASH_ANALYSIS_TOOLS,
        tool_choice: forceToolUse ? 'required' : 'auto',
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
**ก่อนสรุปงานให้ Pro Agent ไปแก้ ต้องอ่านโค้ดจริงก่อนเสมอ ห้ามเดา** — ใช้ read_file/list_files/search_code สำรวจไฟล์ที่เกี่ยวข้องจนเข้าใจว่าโค้ดเชื่อมโยงกันยังไง แล้วค่อยเรียก finalize_task_brief

scope ปัจจุบัน: ${scope || 'root'}
แนวทางเบื้องต้นจากบทสนทนา (ยังไม่ยืนยัน ต้องอ่านโค้ดตรวจก่อน): ${JSON.stringify(initialTaskSpec || {}).slice(0, 800)}

กฎเหล็ก:
1. ต้องเรียก read_file อย่างน้อย 1 ไฟล์ก่อน finalize_task_brief เสมอ (ห้าม finalize จากการเดาล้วนๆ)
2. files_hint สุดท้ายต้องเป็น path ที่ยืนยันแล้วว่ามีอยู่จริงจาก read_file/list_files เท่านั้น
3. ตอบเป็นการเรียก tool เท่านั้นทุกรอบ ห้ามพิมพ์ข้อความเปล่าอธิบายแผนแล้วไม่เรียก tool
4. มีเวลาจำกัด ${MAX_ITERATIONS} รอบ — ถ้าเข้าใจพอแล้วให้ finalize ทันที ไม่ต้องอ่านเกินจำเป็น`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-6),
    { role: 'user', content: message },
  ];

  let filesRead = 0;

  for (let iterations = 1; iterations <= MAX_ITERATIONS; iterations++) {
    await writeProgress(requestId, `จีจี้กำลังอ่านโค้ดก่อนสรุปงาน... (รอบ ${iterations}/${MAX_ITERATIONS})`, 'flash');

    const choice = await callFlashWithTools(apiKey, messages, true);
    const am = choice.message;
    messages.push({ role: 'assistant', content: am.content || null, tool_calls: am.tool_calls || undefined });

    if (!am.tool_calls || am.tool_calls.length === 0) {
      messages.push({
        role: 'user',
        content: '⚠️ ต้องเรียก tool เท่านั้น (read_file / list_files / search_code / finalize_task_brief) ห้ามพิมพ์ข้อความเปล่า',
      });
      continue;
    }

    for (const toolCall of am.tool_calls) {
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* use empty */ }

      if (toolCall.function.name === 'finalize_task_brief') {
        if (filesRead === 0) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: '❌ ยังไม่ได้ read_file เลยสักไฟล์ — ต้องอ่านโค้ดจริงก่อน finalize_task_brief',
          });
          continue;
        }
        return { taskSpec: args, iterations };
      }

      if (toolCall.function.name === 'read_file') filesRead++;
      // รายงานหน้าแชทว่าจีจี้กำลังอ่าน/ค้นอะไรจริง (พีชขอเห็นระดับไฟล์ ไม่ใช่แค่เลขรอบ)
      const toolLabel = ({
        read_file: `จีจี้กำลังอ่าน ${args.path || 'ไฟล์'}...`,
        list_files: `จีจี้กำลังไล่ดูโครงสร้าง ${args.dir || 'repo'}...`,
        search_code: `จีจี้กำลังค้นหา "${args.pattern || ''}" ในโค้ด...`,
      })[toolCall.function.name];
      if (toolLabel) await writeProgress(requestId, toolLabel, 'flash');
      const resultText = await executeFlashTool(toolCall.function.name, args, { ghPatRead, projectTree });
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
    }
  }

  return null; // เกิน MAX_ITERATIONS — caller fallback ไป initialTaskSpec
}

module.exports = { runFlashAnalysisLoop, FLASH_ANALYSIS_TOOLS, MAX_ITERATIONS };

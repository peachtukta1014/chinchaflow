/**
 * flashAnalysisLoop.js — Detective Flash Analysis Loop
 *
 * 3-Section Detective Architecture:
 *   SECTION 1: Case File Init — เปิดคดีใน Firestore ก่อนเข้า loop (ทำใน aiChatAgent.js)
 *   SECTION 2: Detective Loop — 8 รอบ/block, สูงสุด 4 blocks = 32 รอบ
 *              investigationState จัดการ scannedPaths, proposedFixes, impactHypotheses, cluesQueue
 *   SECTION 3: Archive + Return — คอมไพล์ Specification Brief, archive, return (ทำใน aiChatAgent.js)
 *
 * Detective Guards:
 *   - Duplicate Read: บล็อก read_file ซ้ำ → ชี้ไปที่ scannedPaths/cluesQueue แทน
 *   - Impact Mapping: record_fix_location → ต้องทำ impact analysis ก่อนหยุด
 *   - Certainty Gate: finalize_task_brief → บล็อกถ้า isReadyToFix = false
 *   - Block Handoff: checkpoint → serialize investigationState → Firestore → compress messages
 */

const { OPENROUTER_BASE, FLASH_MODEL } = require('./flashModels');
const { fetchRepoFiles, saveInvestigationState, fetchScopeSkill } = require('./flashContext');
const { writeProgress, writeTokenLog } = require('../shared/progressTracker');
const { formatChainForPrompt } = require('../shared/chainLockService');

const FLASH_ANALYSIS_MODEL = process.env.FLASH_MODEL || FLASH_MODEL;
const ROUNDS_PER_BLOCK = 8;
const MAX_BLOCKS = 4;
const MIN_FILES_BEFORE_FINALIZE = 2;
const EXPLORE_ONLY_ROUNDS = 3;
const CALL_TIMEOUT_MS = 60 * 1000;
const WALL_CLOCK_LIMIT_MS = 450 * 1000; // 450s — หยุดก่อน CF timeout (540s) ให้เหลือเวลา finalize + archive
const MAX_ITERATIONS = ROUNDS_PER_BLOCK;

// ── Tool Definitions ────────────────────────────────────────────────────────

const READ_ONLY_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'อ่านเนื้อไฟล์ทั้งหมดจาก GitHub repo (read-only) — ระบบจะบล็อกถ้าไฟล์นั้นอยู่ใน scannedPaths แล้ว',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'path ไฟล์ relative จาก repo root' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'ดู project tree ปัจจุบัน — ใส่ dir เพื่อกรองเฉพาะบรรทัดที่เกี่ยวข้อง',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'คำค้นกรองบรรทัด (ไม่ใส่ = ดูทั้งหมด)' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'ค้นหา string pattern ในไฟล์ที่ระบุ (สูงสุด 5 ไฟล์) — ใช้เช็คความเชื่อมโยงข้ามไฟล์',
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

// เครื่องมือ Detective — ใช้ระหว่าง Phase 2 (impact analysis) และ Phase 4 (finalize)
const DETECTIVE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'record_fix_location',
      description: 'บันทึก fix location ที่ยืนยันจากโค้ดจริงแล้ว — เรียกทันทีเมื่อพบ function/โค้ดที่ต้องแก้ จากนั้น ไม่หยุด ต้องทำ impact analysis ทันที',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'unique id เช่น fix-1' },
          file: { type: 'string', description: 'path ไฟล์ที่ต้องแก้' },
          changeDescription: { type: 'string', description: 'อธิบายสั้นๆ ว่าต้องแก้อะไร' },
          originalSnippet: { type: 'string', description: 'โค้ดต้นฉบับก่อนแก้ (snippet สำหรับ search-replace)' },
        },
        required: ['id', 'file', 'changeDescription'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_impact_hypothesis',
      description: 'เพิ่มไฟล์ที่คาดว่ากระทบจาก fix — จะถูกเพิ่มเข้า cluesQueue โดยอัตโนมัติ ต้องอ่านและยืนยันก่อน finalize ได้',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'unique id เช่น hyp-1' },
          targetFile: { type: 'string', description: 'path ไฟล์ที่สงสัยว่ากระทบ' },
          description: { type: 'string', description: 'เหตุผลที่คาดว่ากระทบ (เช่น import function นี้)' },
        },
        required: ['id', 'targetFile', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_hypothesis_safe',
      description: 'ยืนยันว่าไฟล์นี้ไม่กระทบจาก fix (หลัง read_file ตรวจแล้ว) — เมื่อยืนยันครบทุก hypothesis จึงเรียก finalize_task_brief ได้',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'hypothesis id ที่ต้องการยืนยัน' },
          evidenceFound: { type: 'string', description: 'หลักฐานที่บ่งชี้ว่าไม่กระทบ (เช่น ไม่ได้ import function นี้)' },
        },
        required: ['id', 'evidenceFound'],
      },
    },
  },
];

const FINALIZE_TOOL = {
  type: 'function',
  function: {
    name: 'finalize_task_brief',
    description: `เรียกเมื่อ analysisCertainty.isReadyToFix = true เท่านั้น (ต้อง read_file ≥${MIN_FILES_BEFORE_FINALIZE} ไฟล์, cluesQueue ว่าง, และ impactHypotheses ทุกตัว VERIFIED_SAFE) — สรุป Task Brief ส่งให้ Pro Agent`,
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '1 ประโยค: แก้/เพิ่มอะไร ที่ function/component ไหน — ระบุชื่อเจาะจงจากโค้ดที่อ่านจริง' },
        target_behavior: { type: 'string', description: 'พฤติกรรมสุดท้ายที่ระบบต้องทำ มุม user/system' },
        logic_constraints: { type: 'array', items: { type: 'string' }, description: 'invariant ที่ห้ามละเมิด เจาะจงถึงระดับ function' },
        files_hint: {
          type: 'array',
          items: {
            type: 'object',
            properties: { path: { type: 'string' }, fn: { type: 'string' } },
            required: ['path'],
          },
          description: 'ไฟล์ที่ยืนยันแล้ว เรียงจากไฟล์หลักที่ต้องแก้ก่อน',
        },
        diff_expectation: { type: 'string', description: '1-2 ประโยค: จะเปลี่ยนอะไรในโค้ด' },
        isHighRisk: { type: 'boolean', description: 'true ถ้ากระทบ ราคา/VAT/FIFO/lineOrders/auth/Firestore schema/แก้ >3 ไฟล์' },
        risk_reason: { type: 'string', description: '1 ประโยค: ทำไมถึงประเมินความเสี่ยงระดับนี้' },
      },
      required: ['description', 'target_behavior', 'files_hint', 'isHighRisk'],
    },
  },
};

const FLASH_ANALYSIS_TOOLS = [...READ_ONLY_TOOLS, ...DETECTIVE_TOOLS, FINALIZE_TOOL];

// ── Detective State Helpers ─────────────────────────────────────────────────

function _buildInitialDetectiveState(initialTaskSpec) {
  const rawFiles = Array.isArray(initialTaskSpec?.files_hint) ? initialTaskSpec.files_hint : [];
  const cluesQueue = rawFiles.map(f => (typeof f === 'string' ? f : f?.path)).filter(Boolean);
  return {
    scannedPaths: [],
    proposedFixes: [],
    impactHypotheses: [],
    cluesQueue: [...cluesQueue],
    analysisCertainty: {
      score: 0,
      isReadyToFix: false,
      reasoning: cluesQueue.length === 0 ? 'initial — ยังไม่มี fix หรือ hypothesis' : `initial — cluesQueue มี ${cluesQueue.length} รายการต้องตรวจ`,
    },
  };
}

function _recalculateCertainty(state) {
  const hasFixes = state.proposedFixes.length > 0;
  const totalHyp = state.impactHypotheses.length;
  const verifiedHyp = state.impactHypotheses.filter(h => h.status === 'VERIFIED_SAFE').length;
  const queueEmpty = state.cluesQueue.length === 0;
  const allVerified = totalHyp === 0 || verifiedHyp === totalHyp;

  let score = 0;
  if (state.scannedPaths.length > 0) score += 20;
  if (hasFixes) score += 30;
  if (totalHyp > 0) score += Math.floor((verifiedHyp / totalHyp) * 30);
  if (queueEmpty && hasFixes && allVerified) score += 20;

  state.analysisCertainty.score = Math.min(100, score);
  state.analysisCertainty.isReadyToFix = queueEmpty && allVerified;
  state.analysisCertainty.reasoning = `files=${state.scannedPaths.length}, fixes=${state.proposedFixes.length}, hyp=${verifiedHyp}/${totalHyp}, queue=${state.cluesQueue.length}`;
}

function _buildStateContextMessage(state, blockNum, maxBlocks) {
  const pendingHyp = state.impactHypotheses.filter(h => h.status === 'PENDING_VERIFICATION');
  const lines = [
    `📋 **Investigation State (block ${blockNum}/${maxBlocks})**`,
    `- scannedPaths: [${state.scannedPaths.join(', ')}]`,
    `- proposedFixes: ${state.proposedFixes.length} (${state.proposedFixes.map(f => f.file).join(', ')})`,
    `- impactHypotheses: ${state.impactHypotheses.length} total, ${state.impactHypotheses.length - pendingHyp.length} verified`,
    `- cluesQueue: [${state.cluesQueue.join(', ')}]`,
    `- certainty: score=${state.analysisCertainty.score}, isReadyToFix=${state.analysisCertainty.isReadyToFix}`,
  ];
  if (state.cluesQueue.length > 0) {
    lines.push(`\n⬇️ **งานถัดไป:** อ่านไฟล์แรกใน queue: \`${state.cluesQueue[0]}\``);
  } else if (pendingHyp.length > 0) {
    lines.push(`\n⬇️ **งานถัดไป:** ยืนยัน hypothesis: [${pendingHyp.map(h => h.targetFile).join(', ')}]`);
  } else {
    lines.push('\n✅ **isReadyToFix = true** — เรียก finalize_task_brief ได้เลย');
  }
  return lines.join('\n');
}

// ── OpenRouter Caller ───────────────────────────────────────────────────────

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
  choice._usage = data.usage || null;
  return choice;
}

// ── Tool Executor (รวม detective tools + guards) ────────────────────────────

async function executeFlashTool(name, args, { ghPatRead, projectTree, investigationState }) {
  switch (name) {
    case 'read_file': {
      if (!args.path) return '❌ ต้องระบุ path';

      // Detective Guard: duplicate read block
      if (investigationState && investigationState.scannedPaths.includes(args.path)) {
        const nextClue = investigationState.cluesQueue[0];
        return `⚠️ **Detective Guard:** \`${args.path}\` อยู่ใน scannedPaths แล้ว — ห้ามอ่านซ้ำ\n` +
          `ดูข้อมูลจาก investigationState แทน\n` +
          (nextClue ? `⬇️ ไฟล์ถัดไปใน cluesQueue: \`${nextClue}\`` : '✅ cluesQueue ว่างแล้ว — เรียก finalize_task_brief หรือ record_fix_location');
      }

      const found = await fetchRepoFiles(ghPatRead, [args.path]);
      const content = found[args.path];
      if (!content) return `❌ ไม่พบไฟล์: ${args.path}`;

      // อัปเดต detective state (scannedPaths = single source of truth)
      if (investigationState) {
        investigationState.scannedPaths.push(args.path);
        investigationState.cluesQueue = investigationState.cluesQueue.filter(p => p !== args.path);
        _recalculateCertainty(investigationState);
      }

      return `=== ${args.path} ===\n${content}`;
    }

    case 'list_files': {
      if (!projectTree) return '❌ ไม่มี project tree ใน Firestore (systemConfig/projectTree ว่าง)';
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
        : `ไม่พบ "${args.pattern}" ในไฟล์ที่ระบุ`;
    }

    // ── Detective Tools ───────────────────────────────────────────────────

    case 'record_fix_location': {
      if (!investigationState) return '❌ investigationState ไม่พร้อม';
      if (!args.file || !args.changeDescription) return '❌ ต้องระบุ file และ changeDescription';
      const fix = {
        id: args.id || `fix-${Date.now()}`,
        file: args.file,
        changeDescription: args.changeDescription,
        originalSnippet: args.originalSnippet || '',
        status: 'DRAFT',
      };
      investigationState.proposedFixes.push(fix);
      _recalculateCertainty(investigationState);
      return `✅ บันทึก fix: \`${args.file}\`\n📝 ${args.changeDescription}\n\n` +
        `⚡ **Impact Analysis Required (ห้ามหยุด):**\n` +
        `ต้องตรวจว่า fix นี้กระทบไฟล์อื่นหรือไม่:\n` +
        `1. search_code หา import/function ที่จะแก้\n` +
        `2. เรียก add_impact_hypothesis สำหรับทุกไฟล์ที่น่ากระทบ\n` +
        `ถ้ามั่นใจว่าไม่มีไฟล์กระทบ → เรียก finalize_task_brief ได้เลย`;
    }

    case 'add_impact_hypothesis': {
      if (!investigationState) return '❌ investigationState ไม่พร้อม';
      if (!args.targetFile || !args.description) return '❌ ต้องระบุ targetFile และ description';
      if (investigationState.impactHypotheses.find(h => h.id === args.id)) {
        return `⚠️ hypothesis id "${args.id}" มีอยู่แล้ว — ใช้ id ใหม่`;
      }
      const hyp = {
        id: args.id || `hyp-${Date.now()}`,
        targetFile: args.targetFile,
        description: args.description,
        status: 'PENDING_VERIFICATION',
        evidenceFound: '',
      };
      investigationState.impactHypotheses.push(hyp);
      if (!investigationState.cluesQueue.includes(args.targetFile)) {
        investigationState.cluesQueue.push(args.targetFile);
      }
      _recalculateCertainty(investigationState);
      return `📌 เพิ่ม hypothesis: \`${args.targetFile}\` — ${args.description}\n` +
        `เพิ่มเข้า cluesQueue แล้ว → ต้อง read_file แล้วเรียก mark_hypothesis_safe\n` +
        `cluesQueue ปัจจุบัน: [${investigationState.cluesQueue.join(', ')}]`;
    }

    case 'mark_hypothesis_safe': {
      if (!investigationState) return '❌ investigationState ไม่พร้อม';
      if (!args.id) return '❌ ต้องระบุ id';
      const hyp = investigationState.impactHypotheses.find(h => h.id === args.id);
      if (!hyp) return `❌ ไม่พบ hypothesis id: "${args.id}" — ตรวจสอบ id ที่ถูกต้อง`;
      hyp.status = 'VERIFIED_SAFE';
      hyp.evidenceFound = args.evidenceFound || '';
      investigationState.cluesQueue = investigationState.cluesQueue.filter(p => p !== hyp.targetFile);
      _recalculateCertainty(investigationState);
      const { isReadyToFix, score } = investigationState.analysisCertainty;
      const remaining = investigationState.impactHypotheses.filter(h => h.status === 'PENDING_VERIFICATION');
      return `✅ Verified safe: \`${hyp.targetFile}\`\nหลักฐาน: ${args.evidenceFound || '(ไม่ระบุ)'}\n\n` +
        (isReadyToFix
          ? `🎯 **analysisCertainty.isReadyToFix = true** (score=${score})\nเรียก finalize_task_brief ได้เลย!`
          : `cluesQueue ที่เหลือ: [${investigationState.cluesQueue.join(', ')}]\nHypotheses ที่ยังต้องยืนยัน: [${remaining.map(h => h.targetFile).join(', ')}]`);
    }

    default:
      return `❌ ไม่รู้จัก tool "${name}"`;
  }
}

// ── Block Runner ────────────────────────────────────────────────────────────

async function runOneBlock(apiKey, messages, { ghPatRead, projectTree, requestId, blockNum, totalIterationsBefore, investigationState, loopStartTime, tokenUsage }) {
  const isFirstBlock = blockNum === 1;
  const scannedCount = () => investigationState?.scannedPaths?.length ?? 0;

  for (let round = 1; round <= ROUNDS_PER_BLOCK; round++) {
    // Wall-clock guard: ป้องกัน CF timeout (540s) — หยุดก่อน 60s สุดท้ายเพื่อให้ finalize ทัน
    if (loopStartTime && Date.now() - loopStartTime > WALL_CLOCK_LIMIT_MS) {
      console.warn(`[Flash] wall-clock limit reached (${Math.round((Date.now() - loopStartTime) / 1000)}s) — forcing early return`);
      return null;
    }

    const totalIter = totalIterationsBefore + round;
    const isExplorePhase = isFirstBlock && round <= EXPLORE_ONLY_ROUNDS;
    const iterTools = isExplorePhase ? READ_ONLY_TOOLS : FLASH_ANALYSIS_TOOLS;

    const certaintyScore = investigationState?.analysisCertainty?.score ?? 0;
    const phaseLabel = isExplorePhase
      ? `🕵️ สำรวจโค้ด... (block ${blockNum} รอบ ${round}/${ROUNDS_PER_BLOCK} — อ่านแล้ว ${scannedCount()} ไฟล์)`
      : `🔍 วิเคราะห์ผลกระทบ... (block ${blockNum} รอบ ${round}/${ROUNDS_PER_BLOCK} — certainty=${certaintyScore})`;
    await writeProgress(requestId, phaseLabel, 'flash');

    const choice = await callFlashWithTools(apiKey, messages, true, iterTools);
    if (choice._usage && tokenUsage) {
      tokenUsage.prompt_tokens += choice._usage.prompt_tokens || 0;
      tokenUsage.completion_tokens += choice._usage.completion_tokens || 0;
      tokenUsage.total_tokens += choice._usage.total_tokens || 0;
      tokenUsage.calls++;
    }
    const am = choice.message;
    messages.push({ role: 'assistant', content: am.content || null, tool_calls: am.tool_calls || undefined });

    if (!am.tool_calls || am.tool_calls.length === 0) {
      messages.push({
        role: 'user',
        content: '⚠️ ต้องเรียก tool เท่านั้น ห้ามพิมพ์ข้อความเปล่า — ยังต้องสืบสวนต่อ',
      });
      continue;
    }

    for (const toolCall of am.tool_calls) {
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* use empty */ }

      if (toolCall.function.name === 'finalize_task_brief') {
        // Guard 1: MIN_FILES (ใช้ scannedPaths เป็น single source of truth)
        if (scannedCount() < MIN_FILES_BEFORE_FINALIZE) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `❌ อ่านไปแค่ ${scannedCount()} ไฟล์ — ต้อง read_file อย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์ก่อน finalize`,
          });
          continue;
        }

        // Guard 2: Detective certainty gate
        if (investigationState && !investigationState.analysisCertainty.isReadyToFix) {
          const pending = investigationState.impactHypotheses.filter(h => h.status === 'PENDING_VERIFICATION');
          const queueItems = investigationState.cluesQueue;
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `🛑 **Detective Guard — ยังไม่พร้อม finalize:**\n` +
              `- cluesQueue: [${queueItems.join(', ')}] (${queueItems.length} รายการ)\n` +
              `- Hypotheses ที่ยังไม่ยืนยัน: [${pending.map(h => h.targetFile).join(', ')}]\n\n` +
              `ต้องทำก่อน:\n` +
              `1. read_file ไฟล์ใน cluesQueue\n` +
              `2. mark_hypothesis_safe สำหรับทุก hypothesis\n` +
              `จากนั้นจึงเรียก finalize_task_brief ได้`,
          });
          continue;
        }

        return { taskSpec: args, totalIterations: totalIter, investigationState };
      }

      // Progress label สำหรับ read/list/search
      const toolLabel = ({
        read_file: `🕵️ อ่าน ${args.path || 'ไฟล์'}...`,
        list_files: `🕵️ ไล่ดูโครงสร้าง ${args.dir || 'repo'}...`,
        search_code: `🔍 ค้น "${args.pattern || ''}"...`,
        record_fix_location: `📝 บันทึก fix: ${args.file || ''}...`,
        add_impact_hypothesis: `📌 เพิ่ม hypothesis: ${args.targetFile || ''}...`,
        mark_hypothesis_safe: `✅ ยืนยัน hypothesis ${args.id || ''}...`,
      })[toolCall.function.name];
      if (toolLabel) await writeProgress(requestId, toolLabel, 'flash');

      const resultText = await executeFlashTool(toolCall.function.name, args, {
        ghPatRead, projectTree, investigationState,
      });
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
    }

    if (isExplorePhase && scannedCount() > 0) {
      messages.push({
        role: 'user',
        content: `📊 สรุปรอบสำรวจ: อ่านแล้ว ${scannedCount()} ไฟล์ [${investigationState.scannedPaths.join(', ')}] — ยังอยู่ช่วงสำรวจ (รอบ ${round}/${EXPLORE_ONLY_ROUNDS}) ค้นหาไฟล์ที่เกี่ยวข้องเพิ่มได้`,
      });
    }
  }

  return null;
}

// ── Main Entry Point ────────────────────────────────────────────────────────

async function runFlashAnalysisLoop(apiKey, ghPatRead, { message, history, scope, initialTaskSpec, projectTree, requestId }) {
  if (!ghPatRead) return null;

  const chainContext = await formatChainForPrompt(scope || 'root').catch(() => '');
  const maxTotalRounds = MAX_BLOCKS * ROUNDS_PER_BLOCK;

  // SECTION 2: Initialize investigationState (detective working memory)
  const investigationState = _buildInitialDetectiveState(initialTaskSpec || {});

  // Token tracking accumulator
  const tokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0 };

  // โหลด scope-specific skill context (ถ้ามี)
  const scopeSkill = await fetchScopeSkill(ghPatRead, scope || 'root').catch(() => '');
  const scopeSkillBlock = scopeSkill ? `\n\n**Scope Skill (${scope}):**\n${scopeSkill}` : '';

  const systemPrompt = `คุณคือจีจี้ — 🕵️ Detective Technical Analyst ของ CHINCHA FLOW
กำลังสืบสวน task นี้อย่างเป็นระบบก่อนส่ง Task Brief ให้ Pro Agent

**🕵️ Detective Protocol (ทำตามลำดับเคร่งครัด):**

**Phase 1 — Explore (สำรวจ):** list_files/read_file/search_code ดูโครงสร้างและอ่านไฟล์ใน cluesQueue
**Phase 2 — Record Fix (ระบุ fix):** เมื่อพบ function/โค้ดที่ต้องแก้จริงๆ → เรียก record_fix_location ทันที
**Phase 3 — Impact Analysis (ตรวจผลกระทบ):** หลัง record_fix_location → คิดถึง side-effects → add_impact_hypothesis → read_file แต่ละตัว → mark_hypothesis_safe
**Phase 4 — Finalize:** เมื่อ analysisCertainty.isReadyToFix = true → เรียก finalize_task_brief

**กฎเหล็ก:**
1. ห้าม read_file ซ้ำ (ระบบบล็อก + ชี้ไฟล์ถัดไปใน cluesQueue แทน)
2. พบ fix location → impact analysis ทันที ห้ามหยุด
3. ห้าม finalize ก่อน isReadyToFix = true (ระบบบล็อก)
4. ต้อง read_file อย่างน้อย ${MIN_FILES_BEFORE_FINALIZE} ไฟล์ก่อน finalize
5. ตอบเป็น tool call เท่านั้นทุกรอบ

scope: ${scope || 'root'}
แนวทางเบื้องต้น: ${JSON.stringify(initialTaskSpec || {}).slice(0, 600)}
สูงสุด ${maxTotalRounds} รอบ (${MAX_BLOCKS} blocks × ${ROUNDS_PER_BLOCK} รอบ)${chainContext}${scopeSkillBlock}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-6),
    { role: 'user', content: message },
  ];

  const loopStartTime = Date.now();

  for (let block = 1; block <= MAX_BLOCKS; block++) {
    // Wall-clock guard ระดับ block
    if (Date.now() - loopStartTime > WALL_CLOCK_LIMIT_MS) {
      console.warn(`[Flash] wall-clock limit at block start (block ${block}) — skipping to force finalize`);
      break;
    }

    const totalIterationsBefore = (block - 1) * ROUNDS_PER_BLOCK;

    const result = await runOneBlock(apiKey, messages, {
      ghPatRead, projectTree, requestId,
      blockNum: block,
      totalIterationsBefore,
      investigationState,
      loopStartTime,
      tokenUsage,
    });

    if (result) {
      await writeTokenLog(requestId, { flashAnalysis: tokenUsage }).catch(() => {});
      return { taskSpec: result.taskSpec, iterations: result.totalIterations, investigationState: result.investigationState, tokenUsage };
    }

    if (block < MAX_BLOCKS) {
      // Block checkpoint: serialize state → Firestore, compress messages (anti-token-bloat)
      const stateMsg = _buildStateContextMessage(investigationState, block, MAX_BLOCKS);
      await writeProgress(requestId, `🔄 checkpoint block ${block}/${MAX_BLOCKS} — certainty=${investigationState.analysisCertainty.score}`, 'flash');
      await saveInvestigationState(requestId, { investigationState, block, filesRead: investigationState.scannedPaths.length }).catch(() => {});

      // เก็บ last assistant content สำหรับ context carry-over (ป้องกัน context loss ข้าม block)
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
      const carryOver = lastAssistantMsg?.content
        ? `\n\n📝 สรุปรอบก่อน: ${typeof lastAssistantMsg.content === 'string' ? lastAssistantMsg.content.slice(0, 500) : ''}`
        : '';

      // ลบ heavy tool logs ออกจาก messages → compress เป็น state summary + carry-over
      const systemMsg = messages[0];
      messages.length = 0;
      messages.push(
        systemMsg,
        { role: 'user', content: message },
        { role: 'user', content: `${stateMsg}${carryOver}\n\nดำเนินการสืบสวนต่อ block ${block + 1}/${MAX_BLOCKS} — ยังมีเวลาอีก ${(MAX_BLOCKS - block) * ROUNDS_PER_BLOCK} รอบ\nถ้า isReadyToFix = true → เรียก finalize_task_brief ได้เลย` }
      );
    }
  }

  // Force finalize หลังครบทุก block / wall-clock limit
  const scannedFiles = investigationState.scannedPaths;
  if (scannedFiles.length >= MIN_FILES_BEFORE_FINALIZE) {
    try {
      const elapsedSec = Math.round((Date.now() - loopStartTime) / 1000);
      await writeProgress(requestId, `🕵️ ครบ ${maxTotalRounds} รอบ (${elapsedSec}s) — กำลังสรุป Task Brief จากที่รวบรวมได้...`, 'flash');

      // Inject certainty warning ให้ model รู้ว่ายังไม่ครบ
      const pendingHyp = investigationState.impactHypotheses.filter(h => h.status === 'PENDING_VERIFICATION');
      const certaintyWarning = !investigationState.analysisCertainty.isReadyToFix
        ? `\n⚠️ **Investigation ยังไม่สมบูรณ์:** cluesQueue=[${investigationState.cluesQueue.join(', ')}], unverified hypotheses=[${pendingHyp.map(h => h.targetFile).join(', ')}]\nสรุปจากข้อมูลที่มี — ระบุส่วนที่ยังไม่แน่ใจใน logic_constraints`
        : '';

      messages.push({
        role: 'user',
        content: `⚠️ ครบรอบทั้งหมดแล้ว (${scannedFiles.length} ไฟล์: ${scannedFiles.join(', ')}) — เรียก finalize_task_brief ตอนนี้เลย สรุปจากสิ่งที่รู้ทั้งหมด${certaintyWarning}`,
      });
      const finalChoice = await callFlashWithTools(apiKey, messages, 'finalize_task_brief');
      if (finalChoice._usage) {
        tokenUsage.prompt_tokens += finalChoice._usage.prompt_tokens || 0;
        tokenUsage.completion_tokens += finalChoice._usage.completion_tokens || 0;
        tokenUsage.total_tokens += finalChoice._usage.total_tokens || 0;
        tokenUsage.calls++;
      }
      const tc = (finalChoice.message?.tool_calls || [])[0];
      if (tc?.function?.name === 'finalize_task_brief') {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* use empty */ }
        if (args.description && args.target_behavior) {
          await writeTokenLog(requestId, { flashAnalysis: tokenUsage }).catch(() => {});
          return { taskSpec: args, iterations: maxTotalRounds + 1, forcedFinalize: true, investigationIncomplete: !investigationState.analysisCertainty.isReadyToFix, investigationState, tokenUsage };
        }
      }
    } catch (err) {
      console.warn('force finalize หลังครบรอบล้มเหลว — fallback ไป initialTaskSpec:', err.message);
    }
  }
  await writeTokenLog(requestId, { flashAnalysis: tokenUsage }).catch(() => {});
  return null;
}

module.exports = { runFlashAnalysisLoop, FLASH_ANALYSIS_TOOLS, READ_ONLY_TOOLS, DETECTIVE_TOOLS, MAX_ITERATIONS, MIN_FILES_BEFORE_FINALIZE, EXPLORE_ONLY_ROUNDS, ROUNDS_PER_BLOCK, MAX_BLOCKS, WALL_CLOCK_LIMIT_MS };

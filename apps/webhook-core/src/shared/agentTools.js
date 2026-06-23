/**
 * agentTools.js — Agentic loop orchestrator สำหรับ จีจี้
 *
 * Tool definitions → toolDefinitions.js
 * Tool executors   → toolExecutors.js
 */

const { writeProgress, appendRunLog } = require('./progressTracker');
const { TOOL_DEFINITIONS, OPENROUTER_BASE, AGENT_MODEL } = require('./toolDefinitions');
const { fetchRepoFile, executeTool } = require('./toolExecutors');

// ── Strip DeepSeek internal DSML markup from text ─────────────────────────
// DeepSeek V4 Pro sometimes leaks <｜DSML｜...> tags in the text content
// alongside structured tool_calls — strip before surfacing to user/history
function stripDsml(text) {
  if (!text) return text;
  // Remove complete DSML blocks: <｜DSML｜tag>...</｜DSML｜tag>
  let out = text.replace(/<[|｜]DSML[|｜][^>]*>[\s\S]*?<\/[|｜]DSML[|｜][^>]*>/g, '');
  // Strip any remaining DSML content from first opening tag to end
  out = out.replace(/\n?<[|｜]DSML[|｜][\s\S]*$/g, '');
  return out.trim();
}

// ── Tool names (shared by XML parser and stripper) ─────────────────────────
const XML_TOOL_NAMES = [
  'read_file', 'list_files', 'search_code', 'patch_file', 'write_file',
  'commit_and_pr', 'trigger_deploy', 'get_skill', 'exec_command', 'report_no_action_needed',
];

// ── Strip XML tool call syntax from final reply ────────────────────────────
// โมเดลบางครั้งใส่ <tool_name>...</tool_name> ในข้อความสรุปผล — ลบออกก่อนส่งให้พี่
function stripXmlToolCalls(text) {
  if (!text) return text;
  const pattern = `<(${XML_TOOL_NAMES.join('|')})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`;
  return text.replace(new RegExp(pattern, 'g'), '').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Parse XML-format tool calls (DeepSeek V4 Pro fallback) ────────────────
// DeepSeek บางครั้ง output <read_file><path>...</path></read_file> เป็น text
// แทน structured tool_calls — parse แล้ว execute แทนการวนเตือน 3 รอบแล้ว throw
function parseXmlToolCalls(text) {
  if (!text) return [];
  const results = [];
  for (const toolName of XML_TOOL_NAMES) {
    const re = new RegExp(`<${toolName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${toolName}>`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const args = {};
      const paramRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let p;
      while ((p = paramRe.exec(m[1])) !== null) {
        args[p[1]] = p[2].trim();
      }
      results.push({
        id: `xml-${Date.now()}-${results.length}`,
        function: { name: toolName, arguments: JSON.stringify(args) },
      });
    }
  }
  return results;
}

// ── Call OpenRouter with function calling support ─────────────────────────
// forceToolUse=true → tool_choice:'required' บังคับให้เรียก tool (ใช้ใน iteration แรก)
async function callOpenRouterWithTools(apiKey, messages, tools, model, forceToolUse = false, _retried = false) {
  const useModel = model || process.env.CODE_MODEL || AGENT_MODEL;
  const toolChoice = forceToolUse ? 'required' : 'auto';

  let res;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chincha-flow.web.app',
        'X-Title': 'CHINCHA FLOW AI Agent (Jiji)',
      },
      body: JSON.stringify({
        model: useModel,
        messages,
        tools,
        tool_choice: toolChoice,
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
  } catch (fetchErr) {
    // Retry once on transient network errors (ECONNRESET, ETIMEDOUT, fetch failed)
    if (!_retried) {
      console.warn('callOpenRouterWithTools fetch error — retrying once:', fetchErr.message);
      await new Promise(r => setTimeout(r, 2000));
      return callOpenRouterWithTools(apiKey, messages, tools, model, forceToolUse, true);
    }
    throw fetchErr;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || `HTTP ${res.status}`;
    // Retry once on transient HTTP errors (429 rate-limit, 503 unavailable)
    if (!_retried && (res.status === 429 || res.status === 503)) {
      console.warn(`OpenRouter ${res.status} — retrying once after 2s`);
      await new Promise(r => setTimeout(r, 2000));
      return callOpenRouterWithTools(apiKey, messages, tools, model, forceToolUse, true);
    }
    // ถ้า model ไม่ support tools ให้ fallback ไป gpt-4o-mini
    if (res.status === 400 && useModel !== AGENT_MODEL) {
      console.warn(`Model ${useModel} tool-calling error — retrying with ${AGENT_MODEL}`);
      return callOpenRouterWithTools(apiKey, messages, tools, AGENT_MODEL, forceToolUse);
    }
    throw new Error(`OpenRouter ${res.status} (${useModel}): ${errMsg}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    if (!_retried) {
      console.warn('OpenRouter response JSON parse error — retrying once:', parseErr.message);
      await new Promise(r => setTimeout(r, 2000));
      return callOpenRouterWithTools(apiKey, messages, tools, model, forceToolUse, true);
    }
    throw new Error(`OpenRouter ตอบกลับมาไม่สมบูรณ์ (JSON parse ล้มเหลว): ${parseErr.message}`);
  }
  const choice = data?.choices?.[0];
  if (!choice) throw new Error('OpenRouter ไม่ตอบกลับ');
  return choice;
}

// ── Main agentic loop ──────────────────────────────────────────────────────
// จีจี้เรียก tool เองในแต่ละรอบ จนงานเสร็จหรือเกิน MAX_ITERATIONS
//
// ⚠️ จุดสำคัญ (อ่านก่อนแก้): "งานเสร็จ" ต้องเป็น fact ที่ระบบกำหนด (taskCompleted)
// ไม่ใช่สิ่งที่อนุมานจาก finish_reason ของโมเดล — โมเดล (ไม่ว่าตัวไหน) มีโอกาส
// finish_reason === 'stop' ทั้งที่ยังไม่ได้ลงมือจริง (เช่น พิมพ์ tool call เป็น text
// เปล่าๆ แทนการยิง structured tool_calls) ถ้าเชื่อ finish_reason เฉยๆ จะได้ผลลัพธ์
// "นิ่งกลางทาง" — ดู docs/AGENT_CHANGELOG_TH.md (2026-06-21, "agentic loop ใช้ tools จริง")
async function runAgentLoop(apiKey, ghPat, { message, history, requestId, scopeFileTree, systemPrompt, isHighRisk = true }) {
  const MAX_ITERATIONS = 30;        // รองรับงานซับซ้อนที่ต้องหลายขั้นตอน
  const SUMMARY_CHECKPOINT = 15;    // รอบ 15: บังคับสรุปความคืบหน้า แล้วดำเนินการต่อ
  const stagedFiles = {};

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-10),
    { role: 'user', content: message },
  ];

  let iterations = 0;
  let taskCompleted = false; // set โดยระบบเท่านั้น เมื่อเจอ tool ที่นับว่า "จบงานจริง"
  let consecutiveTextOnlyReplies = 0; // นับรอบที่โมเดลตอบ text ล้วนๆติดกัน (ไม่มี tool_calls)

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Checkpoint ก่อนรอบ 15 — ให้จีจี้สรุปความคืบหน้าก่อนดำเนินการต่อ
    if (iterations === SUMMARY_CHECKPOINT && !taskCompleted) {
      messages.push({
        role: 'user',
        content: `[สรุปความคืบหน้า] คุณทำงานมา ${SUMMARY_CHECKPOINT - 1} รอบแล้ว ` +
          `สรุปสั้นๆ ก่อนดำเนินการต่อ:\n` +
          `1. งานที่ทำเสร็จไปแล้ว\n` +
          `2. งานที่ยังเหลืออยู่\n\n` +
          `หลังสรุปแล้วดำเนินการต่อได้เลย`,
      });
    }

    const stepLabel = iterations === 1
      ? 'จีจี้กำลังวิเคราะห์คำสั่ง...'
      : iterations === SUMMARY_CHECKPOINT
        ? `จีจี้กำลังสรุปความคืบหน้า (รอบ ${iterations})...`
        : `จีจี้กำลังดำเนินการ (รอบ ${iterations})...`;
    await writeProgress(requestId, stepLabel);

    // บังคับ tool_choice='required' ทุกรอบ จนกว่าระบบจะยืนยันว่างานจบจริง (taskCompleted)
    // ยกเว้นรอบ SUMMARY_CHECKPOINT ที่อนุญาตให้ตอบ text สรุปได้
    const forceTools = !taskCompleted && iterations !== SUMMARY_CHECKPOINT;
    const choice = await callOpenRouterWithTools(apiKey, messages, TOOL_DEFINITIONS, undefined, forceTools);
    const assistantMessage = choice.message;

    await appendRunLog(requestId, {
      iteration: iterations,
      finishReason: choice.finish_reason,
      forcedTools: forceTools,
      toolCallCount: assistantMessage.tool_calls?.length || 0,
    });

    // Always push assistant turn to conversation (strip DSML leak from text)
    // DeepSeek thinking-mode (มี tools) บังคับให้ส่ง reasoning ของแต่ละ turn กลับทุกครั้ง
    // ไม่งั้น OpenRouter ตอบ 400 "reasoning_content ... must be passed back to the API"
    // OpenRouter อาจคืน field ชื่อ reasoning_content (native DeepSeek) หรือ reasoning (normalized)
    // → เก็บจากชื่อไหนก็ได้ แล้วส่งกลับทุกชื่อ กันกรณี provider routing ของ OpenRouter เปลี่ยน
    const echoedReasoning = assistantMessage.reasoning_content ?? assistantMessage.reasoning;
    if (iterations === 1) {
      // diagnostic ชั่วคราว: ยืนยันว่า OpenRouter คืน reasoning ผ่าน field ชื่ออะไรจริงๆ
      // (ลบ log บรรทัดนี้ออกได้เมื่อยืนยันชื่อ field แน่นอนแล้ว — ไม่มี content หลุด log แค่ key)
      console.log('[reasoning-debug]', JSON.stringify({
        keys: Object.keys(assistantMessage || {}),
        hasReasoning: assistantMessage.reasoning != null,
        hasReasoningContent: assistantMessage.reasoning_content != null,
        hasReasoningDetails: assistantMessage.reasoning_details != null,
      }));
    }
    messages.push({
      role: 'assistant',
      content: stripDsml(assistantMessage.content) || null,
      reasoning_content: echoedReasoning ?? undefined,
      reasoning: echoedReasoning ?? undefined,
      reasoning_details: assistantMessage.reasoning_details ?? undefined,
      tool_calls: assistantMessage.tool_calls || undefined,
    });

    if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls?.length > 0) {
      consecutiveTextOnlyReplies = 0; // เรียก tool ถูกแล้ว รีเซ็ตตัวนับ
      // Execute each tool call and feed results back
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* use empty */ }

        const progressMsg = {
          read_file: `กำลังอ่านไฟล์: ${args.path || ''}`,
          list_files: 'กำลังดูรายชื่อไฟล์...',
          search_code: `กำลังค้นหา: "${args.pattern || ''}"`,
          patch_file: `กำลัง patch: ${args.path || ''}`,
          write_file: `กำลังเตรียมไฟล์: ${args.path || ''}`,
          commit_and_pr: 'กำลัง commit และเปิด PR...',
          trigger_deploy: `กำลัง trigger deploy: ${args.app || ''}`,
          get_skill: `กำลังอ่าน skill: ${args.name || ''}`,
          exec_command: `กำลังรัน: ${(args.command || '').slice(0, 60)}`,
          report_no_action_needed: 'กำลังสรุปผล...',
        }[toolName] || `กำลังใช้ tool: ${toolName}`;

        await writeProgress(requestId, progressMsg);

        let toolResult;
        try {
          toolResult = await executeTool(toolName, args, { ghPat, scopeFileTree, stagedFiles, isHighRisk });
        } catch (err) {
          toolResult = `❌ Tool error (${toolName}): ${err.message}`;
        }

        // ระบบยืนยัน "จบงานจริง" เฉพาะ 2 เคสนี้เท่านั้น — ไม่ใช่โมเดลเป็นคนบอก
        const resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
        if (toolName === 'commit_and_pr' && resultText.startsWith('✅')) {
          taskCompleted = true;
        } else if (toolName === 'report_no_action_needed') {
          taskCompleted = true;
        }

        await appendRunLog(requestId, {
          iteration: iterations,
          toolName,
          ok: !resultText.startsWith('❌'),
          taskCompleted,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: resultText,
        });
      }
    } else if (!taskCompleted) {
      // รอบ checkpoint — text สรุปคือสิ่งที่เราขอ ไม่นับเป็น text-only ผิดรูปแบบ
      if (iterations === SUMMARY_CHECKPOINT) {
        consecutiveTextOnlyReplies = 0;
        continue;
      }

      // ── XML fallback: DeepSeek บางครั้ง output tool call เป็น XML text ──
      // แทนที่จะส่ง warning แล้วให้โมเดลแก้ตัวเอง (ซึ่งอาจไม่แก้) →
      // parse XML แล้ว execute ตรงๆ เหมือน structured tool_calls จริง
      const xmlCalls = parseXmlToolCalls(assistantMessage.content || '');
      if (xmlCalls.length > 0) {
        consecutiveTextOnlyReplies = 0;
        // Patch ข้อความ assistant ที่ push ไปแล้ว: เปลี่ยนเป็น tool_calls format
        messages[messages.length - 1].content = null;
        messages[messages.length - 1].tool_calls = xmlCalls;

        for (const toolCall of xmlCalls) {
          const toolName = toolCall.function.name;
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* use empty */ }

          await writeProgress(requestId, ({
            read_file: `กำลังอ่านไฟล์: ${args.path || ''}`,
            list_files: 'กำลังดูรายชื่อไฟล์...',
            search_code: `กำลังค้นหา: "${args.pattern || ''}"`,
            patch_file: `กำลัง patch: ${args.path || ''}`,
            write_file: `กำลังเตรียมไฟล์: ${args.path || ''}`,
            commit_and_pr: 'กำลัง commit และเปิด PR...',
            trigger_deploy: `กำลัง trigger deploy: ${args.app || ''}`,
            get_skill: `กำลังอ่าน skill: ${args.name || ''}`,
            exec_command: `กำลังรัน: ${(args.command || '').slice(0, 60)}`,
            report_no_action_needed: 'กำลังสรุปผล...',
          }[toolName] || `กำลังใช้ tool: ${toolName}`));

          let toolResult;
          try {
            toolResult = await executeTool(toolName, args, { ghPat, scopeFileTree, stagedFiles, isHighRisk });
          } catch (err) {
            toolResult = `❌ Tool error (${toolName}): ${err.message}`;
          }

          const resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
          if (toolName === 'commit_and_pr' && resultText.startsWith('✅')) taskCompleted = true;
          else if (toolName === 'report_no_action_needed') taskCompleted = true;

          await appendRunLog(requestId, { iteration: iterations, toolName, ok: !resultText.startsWith('❌'), taskCompleted, xmlFallback: true });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
        }
        continue;
      }

      consecutiveTextOnlyReplies++;

      // หยุด early ถ้าพิมพ์ text ผิดรูปแบบซ้ำเกิน 3 รอบติดกัน — ไม่มีประโยชน์
      // ที่จะวนต่อจนครบ MAX_ITERATIONS เพราะโมเดลไม่ได้ "เรียนรู้" จาก warning
      // เดิม (เคยเจอจริง: สั่งงานเล็กๆอย่าง "list_files ที่ docs/" ก็วนจน 15
      // รอบเพราะพิมพ์ <read_file path="docs/" /> ซ้ำๆ)
      if (consecutiveTextOnlyReplies >= 3) {
        throw new Error(
          `จีจี้พยายามเรียก tool แต่พิมพ์รูปแบบผิดซ ${consecutiveTextOnlyReplies} รอบติดกัน ` +
          `(โมเดลพิมพ์ syntax คล้าย tool call เป็นข้อความธรรมดา ไม่ใช่เรียกจริง) ` +
          `ลองสั่งงานใหม่อีกครั้ง หรือลองใช้คำสั่งที่ตรงชื่อ tool มากขึ้น เช่น "list_files docs/" ` +
          `แทน "list_files ที่ docs/ ก่อน"`
        );
      }

      // ระบุปัญหาเจาะจงขึ้น (ไม่ใช่แค่ "ยังไม่เสร็จ") ให้โมเดลเห็นว่าปัญหาคือ
      // syntax ผิด ไม่ใช่ยังไม่เริ่มทำ — เพิ่มโอกาสที่รอบถัดไปจะเรียกถูก
      const leakedText = (assistantMessage.content || '').slice(0, 200);
      messages.push({
        role: 'user',
        content: `⚠️ คุณพิมพ์ "${leakedText}" เป็นข้อความธรรมดา แต่นี่ไม่ใช่การเรียก tool จริง ` +
          `ระบบไม่เห็นและไม่ execute ให้ — ต้องเรียกผ่าน function calling (tool_calls field) ` +
          `เท่านั้น ห้ามพิมพ์ชื่อ tool หรือ XML/JSON เป็นข้อความในคำตอบเด็ดขาด`,
      });
      continue;
    } else {
      // taskCompleted=true และโมเดลตอบ text ปกติ (สรุปผลให้พี่อ่าน) — จบ loop ได้จริง
      const finalContent = stripXmlToolCalls(stripDsml(assistantMessage.content || ''));
      return {
        reply: finalContent,
        iterations,
        stagedFiles: Object.keys(stagedFiles),
      };
    }
  }

  throw new Error(
    `Agent loop เกิน ${MAX_ITERATIONS} รอบ — งานซับซ้อนเกินไปหรือ AI วนซ้ำ\n` +
    `(มี checkpoint สรุปที่รอบ ${SUMMARY_CHECKPOINT} แล้ว)\n` +
    `ลองอธิบายคำสั่งให้ชัดขึ้นหรือแบ่งงานเป็นขั้นตอนย่อย`
  );
}

module.exports = { TOOL_DEFINITIONS, executeTool, runAgentLoop, fetchRepoFile };

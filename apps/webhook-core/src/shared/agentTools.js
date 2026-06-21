/**
 * agentTools.js — Tool definitions + executor สำหรับ จีจี้ Agentic Loop
 *
 * จีจี้ (DeepSeek V4 Pro via OpenRouter) เรียก tool เหล่านี้ใน loop
 * เพื่ออ่านโค้ดจริง → patch → commit → เปิด PR → trigger deploy
 *
 * Tools:
 *   read_file     — อ่านไฟล์จาก GitHub repo
 *   list_files    — ดูรายชื่อไฟล์ใน scope / directory
 *   search_code   — ค้นหา string pattern ในไฟล์
 *   patch_file    — find & replace เฉพาะส่วน (ต้อง find ตรงเป๊ะ)
 *   write_file    — เขียนไฟล์ใหม่ / rewrite ทั้งไฟล์
 *   commit_and_pr — commit staged files + เปิด PR
 *   trigger_deploy — dispatch GitHub Actions workflow
 *   get_skill     — อ่าน skill definition
 */

const { writeProgress } = require('./progressTracker');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const GH_API = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';
const ADMIN_EMAIL = 'peachtukta1014@gmail.com';
// deepseek-v4-pro: แม่นยำสูง + รองรับ tool calling ผ่าน OpenRouter
const AGENT_MODEL = 'deepseek/deepseek-v4-pro';

// ── Tool definitions (OpenAI function-calling format) ─────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'อ่านเนื้อหาไฟล์จาก GitHub repo — ต้องเรียกก่อน patch_file หรือ write_file ทุกครั้ง ห้ามเดาเนื้อไฟล์',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'path ไฟล์ relative จาก repo root เช่น apps/seafood-pos/src/App.jsx',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'ดูรายชื่อไฟล์ทั้งหมดใน scope หรือ directory ที่กำหนด',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['seafood', 'tea', 'webhook', 'scheduled', 'root'],
            description: 'scope แอป — ถ้าไม่ระบุจะใช้ scope ปัจจุบัน',
          },
          dir: {
            type: 'string',
            description: 'กรอง directory prefix เช่น apps/seafood-pos/src/lib/ (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'ค้นหา string pattern ในไฟล์ที่กำหนด — คืนบรรทัดที่เจอพร้อมหมายเลขบรรทัด',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'ข้อความที่จะค้นหา' },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'รายการ path ไฟล์ที่จะค้น (สูงสุด 10 ไฟล์)',
          },
        },
        required: ['pattern', 'files'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'patch_file',
      description: 'แก้ไขเฉพาะส่วนของไฟล์ด้วย find & replace — ต้อง read_file ก่อน, find ต้องตรงเป๊ะกับไฟล์จริง',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'path ไฟล์' },
          find: {
            type: 'string',
            description: 'ข้อความที่จะแทนที่ — ต้อง copy มาจากผล read_file เป๊ะตัวต่อตัว รวม whitespace/indent',
          },
          replace_with: { type: 'string', description: 'ข้อความใหม่ที่จะแทนที่' },
          reason: { type: 'string', description: 'อธิบายสั้นๆว่าแก้อะไร ทำไม' },
        },
        required: ['path', 'find', 'replace_with', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'เขียนไฟล์ใหม่ทั้งหมด — ใช้สำหรับไฟล์ใหม่หรือไฟล์สั้น (<50 บรรทัด) เท่านั้น สำหรับไฟล์ใหญ่ให้ใช้ patch_file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'path ไฟล์' },
          content: { type: 'string', description: 'เนื้อหาทั้งหมดของไฟล์ (ใหม่หรือ rewrite)' },
          reason: { type: 'string', description: 'อธิบายว่าสร้าง/เปลี่ยนอะไร' },
        },
        required: ['path', 'content', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_and_pr',
      description: 'commit ไฟล์ที่ stage ไว้ทั้งหมด สร้าง branch และเปิด PR ไปที่ main — ทำเป็นขั้นตอนสุดท้ายเสมอ',
      parameters: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'ชื่อ branch เช่น dev/fix-price-display หรือ dev/add-export-feature',
          },
          commit_msg: {
            type: 'string',
            description: 'commit message เช่น "fix: แก้การแสดงราคา" หรือ "feat: เพิ่มปุ่ม export"',
          },
          pr_title: { type: 'string', description: 'ชื่อ PR — ชัดเจน บอกว่าแก้/เพิ่มอะไร' },
          pr_body: {
            type: 'string',
            description: 'รายละเอียด PR (markdown) — สรุปงาน, เหตุผล, ผลที่คาดว่าจะได้',
          },
        },
        required: ['branch', 'commit_msg', 'pr_title', 'pr_body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_deploy',
      description: 'trigger GitHub Actions workflow เพื่อ deploy แอปไปยัง production (ต้องมี GH_PAT ที่มี workflow scope)',
      parameters: {
        type: 'object',
        properties: {
          app: {
            type: 'string',
            enum: ['chincha-tea', 'seafood-pos', 'webhook-core', 'ai-chat'],
            description: 'แอปที่จะ deploy',
          },
          ref: {
            type: 'string',
            description: 'branch หรือ tag ที่จะ deploy (default: main)',
          },
        },
        required: ['app'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_skill',
      description: 'อ่าน skill/command definition — ดูวิธีทำงานของ skill ที่มีในโปรเจกต์',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['auto-shrimp', 'auto-tea', 'ship-shrimp', 'ship-tea', 'land-it', 'peter-ser'],
            description: 'ชื่อ skill',
          },
        },
        required: ['name'],
      },
    },
  },
];

// ── Fetch file from GitHub ─────────────────────────────────────────────────
async function fetchRepoFile(pat, filePath, ref = 'main') {
  const url = `${GH_API}/repos/${GH_REPO}/contents/${filePath}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CF-AI-JIIJI',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${filePath}`);
  const data = await res.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
    path: filePath,
  };
}

// ── Execute a tool call ────────────────────────────────────────────────────
async function executeTool(name, args, { ghPat, scopeFileTree, stagedFiles }) {
  switch (name) {
    case 'read_file': {
      const file = await fetchRepoFile(ghPat, args.path);
      if (!file) return `❌ ไม่พบไฟล์: ${args.path}`;
      const lineCount = file.content.split('\n').length;
      return `=== ${args.path} (${lineCount} บรรทัด) ===\n${file.content}`;
    }

    case 'list_files': {
      const tree = (scopeFileTree && args.scope && scopeFileTree[args.scope])
        ? scopeFileTree[args.scope]
        : (scopeFileTree ? scopeFileTree.root : null);
      if (!tree) return '❌ ไม่พบ scope ที่กำหนด';
      let files = tree.files;
      if (args.dir) files = files.filter(f => f.startsWith(args.dir));
      if (files.length === 0) return `ไม่พบไฟล์ใน ${args.dir || args.scope}`;
      return `ไฟล์ใน ${args.scope || 'scope ปัจจุบัน'}${args.dir ? ' (' + args.dir + ')' : ''}:\n${files.join('\n')}`;
    }

    case 'search_code': {
      const results = [];
      for (const filePath of (args.files || []).slice(0, 10)) {
        try {
          const file = await fetchRepoFile(ghPat, filePath);
          if (!file) continue;
          const lines = file.content.split('\n');
          const matches = lines
            .map((text, i) => ({ line: i + 1, text }))
            .filter(({ text }) => text.includes(args.pattern));
          if (matches.length > 0) {
            results.push(`\n=== ${filePath} ===`);
            matches.slice(0, 5).forEach(m => results.push(`  บรรทัด ${m.line}: ${m.text.trim()}`));
            if (matches.length > 5) results.push(`  ... (และอีก ${matches.length - 5} บรรทัด)`);
          }
        } catch { /* skip */ }
      }
      return results.length > 0
        ? `พบ "${args.pattern}":${results.join('\n')}`
        : `ไม่พบ "${args.pattern}" ในไฟล์ที่กำหนด`;
    }

    case 'patch_file': {
      // อ่านจาก staged ก่อน (อาจ patch ซ้ำหลายครั้ง) ถ้าไม่มีค่อยอ่านจาก GitHub
      let currentContent;
      let currentSha = null;
      if (stagedFiles[args.path]) {
        currentContent = stagedFiles[args.path].content;
        currentSha = stagedFiles[args.path].sha;
      } else {
        const file = await fetchRepoFile(ghPat, args.path);
        if (!file) return `❌ ไม่พบไฟล์ ${args.path} — ต้อง read_file ก่อน`;
        currentContent = file.content;
        currentSha = file.sha;
      }

      if (!currentContent.includes(args.find)) {
        const preview = args.find.slice(0, 100).replace(/\n/g, '↵');
        return `❌ หา "${preview}..." ใน ${args.path} ไม่เจอ\n→ ตรวจว่า find ตรงกับผล read_file เป๊ะ (รวม space/indent) หรือ read_file อีกครั้งเพื่อตรวจ`;
      }

      const newContent = currentContent.replace(args.find, args.replace_with);
      stagedFiles[args.path] = { content: newContent, sha: currentSha, reason: args.reason };
      return `✅ patch สำเร็จ: ${args.path}\nแก้: ${args.reason}`;
    }

    case 'write_file': {
      const existing = await fetchRepoFile(ghPat, args.path).catch(() => null);
      const lineCount = args.content.split('\n').length;
      if (existing && existing.content.split('\n').length > 50 && !args.confirmed_full_rewrite) {
        return `⚠️ ${args.path} มี ${existing.content.split('\n').length} บรรทัด — ควรใช้ patch_file แทนเพื่อความปลอดภัย\n` +
          `ถ้าต้องการ rewrite ทั้งไฟล์จริงๆ ให้เพิ่ม confirmed_full_rewrite: true ใน args`;
      }
      stagedFiles[args.path] = {
        content: args.content,
        sha: existing?.sha || null,
        reason: args.reason,
      };
      return `✅ staged ${args.path} (${lineCount} บรรทัด)${existing ? '' : ' [ไฟล์ใหม่]'}\nสาเหตุ: ${args.reason}`;
    }

    case 'commit_and_pr': {
      const fileCount = Object.keys(stagedFiles).length;
      if (fileCount === 0) {
        return '❌ ไม่มีไฟล์ที่ stage ไว้ — ต้อง patch_file หรือ write_file ก่อน';
      }

      const branchName = (args.branch || 'dev/ai-fix-' + Date.now().toString(36))
        .replace(/[^a-zA-Z0-9/_-]/g, '-')
        .slice(0, 80);
      const commitMsg = args.commit_msg || 'fix: AI agent fix';

      // Get main SHA
      const mainRefRes = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/main`, {
        headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
      });
      if (!mainRefRes.ok) throw new Error(`GitHub ref fetch ${mainRefRes.status}`);
      const mainSha = (await mainRefRes.json()).object.sha;

      // Create branch (ignore 422 if already exists)
      await fetch(`${GH_API}/repos/${GH_REPO}/git/refs`, {
        method: 'POST',
        headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
      });

      // Commit each staged file sequentially (GitHub Contents API)
      const committed = [];
      for (const [filePath, fileData] of Object.entries(stagedFiles)) {
        // Re-fetch current SHA from the branch (not cached from main) to avoid stale SHA mismatches
        const branchFileMeta = await fetchRepoFile(ghPat, filePath, branchName).catch(() => null);
        const liveSha = branchFileMeta?.sha || null;

        const commitBody = {
          message: commitMsg,
          content: Buffer.from(fileData.content).toString('base64'),
          branch: branchName,
          committer: { name: 'จีจี้ (AI)', email: ADMIN_EMAIL },
        };
        if (liveSha) commitBody.sha = liveSha;

        const commitRes = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
          body: JSON.stringify(commitBody),
        });
        if (!commitRes.ok) {
          const err = await commitRes.json().catch(() => ({}));
          throw new Error(`commit ${filePath} ล้มเหลว: ${err.message || commitRes.status}`);
        }
        committed.push(filePath);
      }

      // Auto-add changelog entry
      try {
        const changelog = await fetchRepoFile(ghPat, 'docs/AGENT_CHANGELOG_TH.md', branchName);
        if (changelog) {
          const today = new Date().toISOString().slice(0, 10);
          const entry = `## ${today} — ${args.pr_title}\n- ไฟล์ที่แก้: ${committed.join(', ')}\n- Branch: ${branchName}`;
          const firstEntry = changelog.content.split('\n').find(l => l.startsWith('## '));
          if (firstEntry) {
            const newChangelog = changelog.content.replace(firstEntry, entry + '\n\n' + firstEntry);
            await fetch(`${GH_API}/repos/${GH_REPO}/contents/docs/AGENT_CHANGELOG_TH.md`, {
              method: 'PUT',
              headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
              body: JSON.stringify({
                message: commitMsg,
                content: Buffer.from(newChangelog).toString('base64'),
                branch: branchName,
                sha: changelog.sha,
                committer: { name: 'จีจี้ (AI)', email: ADMIN_EMAIL },
              }),
            });
          }
        }
      } catch { /* changelog failure is non-fatal */ }

      // Open PR
      const prBodyFull = (args.pr_body || '') +
        `\n\n---\n**ไฟล์ที่แก้:** ${committed.join(', ')}\n` +
        `_⏳ pr-verify.yml กำลังรัน smoke test + build อัตโนมัติ — รอผล comment ก่อน merge_`;

      const prRes = await fetch(`${GH_API}/repos/${GH_REPO}/pulls`, {
        method: 'POST',
        headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
        body: JSON.stringify({
          title: args.pr_title || `AI Fix: ${branchName}`,
          head: branchName,
          base: 'main',
          body: prBodyFull,
          draft: false,
        }),
      });

      let prUrl;
      if (!prRes.ok) {
        // Check if PR already exists
        const existRes = await fetch(
          `${GH_API}/repos/${GH_REPO}/pulls?head=peachtukta1014:${branchName}&state=open`,
          { headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' } }
        );
        if (existRes.ok) {
          const prs = await existRes.json();
          if (prs.length > 0) {
            prUrl = prs[0].html_url;
          }
        }
        if (!prUrl) {
          const err = await prRes.json().catch(() => ({}));
          throw new Error(`PR create ล้มเหลว: ${err.message || prRes.status}`);
        }
      } else {
        prUrl = (await prRes.json()).html_url;
      }

      // Clear staged files after successful commit
      Object.keys(stagedFiles).forEach(k => delete stagedFiles[k]);

      return `✅ เปิด PR แล้วครับพี่! ${prUrl}\n\nBranch: ${branchName}\nไฟล์ที่แก้: ${committed.join(', ')}\n\nรอ smoke test + build ผ่านก่อน merge นะครับ 🌸`;
    }

    case 'trigger_deploy': {
      const workflowMap = {
        'chincha-tea': 'deploy-hosting.yml',
        'seafood-pos': 'deploy-hosting.yml',
        'ai-chat': 'deploy-hosting.yml',
        'webhook-core': 'deploy-functions.yml',
      };
      const workflow = workflowMap[args.app] || 'deploy-hosting.yml';
      const ref = args.ref || 'main';

      const res = await fetch(
        `${GH_API}/repos/${GH_REPO}/actions/workflows/${workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${ghPat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'CF-AI',
          },
          body: JSON.stringify({ ref }),
        }
      );

      if (res.status === 204) {
        return `✅ trigger deploy ${args.app} (${workflow} @ ${ref}) แล้วครับ\nดูผลที่ GitHub Actions`;
      }
      const err = await res.json().catch(() => ({}));
      return `❌ trigger deploy ล้มเหลว: HTTP ${res.status} — ${err.message || ''}\n` +
        `→ ตรวจสอบว่า GH_PAT มี "workflow" scope`;
    }

    case 'get_skill': {
      const skillPaths = {
        'auto-shrimp': '.cursor/skills/auto-shrimp/SKILL.md',
        'auto-tea': '.cursor/skills/auto-tea/SKILL.md',
        'ship-shrimp': '.cursor/skills/ship-shrimp/SKILL.md',
        'ship-tea': '.cursor/skills/ship-tea/SKILL.md',
        'land-it': '.claude/commands/land-it.md',
        'peter-ser': '.claude/commands/peter-ser.md',
      };
      const skillPath = skillPaths[args.name];
      if (!skillPath) return `❌ ไม่รู้จัก skill "${args.name}"`;
      const file = await fetchRepoFile(ghPat, skillPath);
      return file
        ? `=== Skill: ${args.name} (${skillPath}) ===\n${file.content}`
        : `❌ ไม่พบไฟล์ skill: ${skillPath}`;
    }

    default:
      return `❌ ไม่รู้จัก tool "${name}" — tools ที่มี: read_file, list_files, search_code, patch_file, write_file, commit_and_pr, trigger_deploy, get_skill`;
  }
}

// ── Call OpenRouter with function calling support ─────────────────────────
// forceToolUse=true → tool_choice:'required' บังคับให้เรียก tool (ใช้ใน iteration แรก)
async function callOpenRouterWithTools(apiKey, messages, tools, model, forceToolUse = false) {
  const useModel = model || process.env.CODE_MODEL || AGENT_MODEL;
  const toolChoice = forceToolUse ? 'required' : 'auto';

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Agent (จีจี้)',
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

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || `HTTP ${res.status}`;
    // ถ้า model ไม่ support tools ให้ fallback ไป gpt-4o-mini
    if (res.status === 400 && useModel !== AGENT_MODEL) {
      console.warn(`Model ${useModel} tool-calling error — retrying with ${AGENT_MODEL}`);
      return callOpenRouterWithTools(apiKey, messages, tools, AGENT_MODEL, forceToolUse);
    }
    throw new Error(`OpenRouter ${res.status} (${useModel}): ${errMsg}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice) throw new Error('OpenRouter ไม่ตอบกลับ');
  return choice;
}

// ── Main agentic loop ──────────────────────────────────────────────────────
// จีจี้เรียก tool เองในแต่ละรอบ จนงานเสร็จหรือเกิน MAX_ITERATIONS
async function runAgentLoop(apiKey, ghPat, { message, history, requestId, scopeFileTree, systemPrompt }) {
  const MAX_ITERATIONS = 15;
  const stagedFiles = {};

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-10),
    { role: 'user', content: message },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const stepLabel = iterations === 1
      ? 'จีจี้กำลังวิเคราะห์คำสั่ง...'
      : `จีจี้กำลังดำเนินการ (รอบ ${iterations})...`;
    await writeProgress(requestId, stepLabel);

    // รอบแรก: บังคับ tool_choice='required' ให้เริ่มใช้ tool ทันที ไม่ถามยืนยัน
    const choice = await callOpenRouterWithTools(apiKey, messages, TOOL_DEFINITIONS, undefined, iterations === 1);
    const assistantMessage = choice.message;

    // Always push assistant turn to conversation
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || null,
      tool_calls: assistantMessage.tool_calls || undefined,
    });

    if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls?.length > 0) {
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
        }[toolName] || `กำลังใช้ tool: ${toolName}`;

        await writeProgress(requestId, progressMsg);

        let toolResult;
        try {
          toolResult = await executeTool(toolName, args, { ghPat, scopeFileTree, stagedFiles });
        } catch (err) {
          toolResult = `❌ Tool error (${toolName}): ${err.message}`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
        });
      }
    } else {
      // finish_reason === 'stop' — จีจี้ตอบจบแล้ว
      const finalContent = assistantMessage.content || '';
      return {
        reply: finalContent,
        iterations,
        stagedFiles: Object.keys(stagedFiles),
      };
    }
  }

  throw new Error(
    `Agent loop เกิน ${MAX_ITERATIONS} รอบ — งานซับซ้อนเกินไปหรือ AI วนซ้ำ\n` +
    `ลองอธิบายคำสั่งให้ชัดขึ้นหรือแบ่งงานเป็นขั้นตอนย่อย`
  );
}

module.exports = { TOOL_DEFINITIONS, executeTool, runAgentLoop, fetchRepoFile };

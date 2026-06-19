/**
 * AI Workflow Agent — Cloud Function for CHINCHA FLOW
 *
 * Receives code-action intent from aiChatAgent, uses OpenRouter (deepseek)
 * as the AI brain to analyze + generate code fixes, then creates a PR via
 * GitHub REST API.
 *
 * Flow:
 *   PWA message → aiChatAgent detects code-action → aiWorkflowAgent
 *     → OpenRouter: analyze repo + generate fix (structured output)
 *     → GitHub API: create branch + commit + open PR
 *
 * No Cursor Cloud — uses OpenRouter + GitHub PAT only (low cost).
 * Model: deepseek/deepseek-chat (or DEFAULT_MODEL from env).
 *
 * Deploy note: requires GH_PAT (GitHub Personal Access Token) for PR creation.
 */

const functions = require('firebase-functions/v1');
const ADMIN_EMAIL = 'peachtukta1014@gmail.com';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const GH_API = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';

// ── Intent detection ────────────────────────────────────────────────────
function isCodeAction(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    t.includes('แก้โค้ด') || t.includes('แก้bug') || t.includes('แก้บั๊ก') ||
    t.includes('fix code') || t.includes('fix bug') || t.includes('fix this') ||
    (t.includes('สร้าง') && (t.includes('feature') || t.includes('ฟีเจอร์'))) ||
    t.includes('add feature') || t.includes('add code') ||
    t.includes('refactor') || t.includes('ปรับโครงสร้าง') || t.includes('rewrite') ||
    t.includes('deploy') || t.includes('ดีพลอย') || t.includes('merge') ||
    t.includes('pr') || t.includes('pull request') ||
    t.includes('ช่วยเขียน') || t.includes('implement') ||
    t.includes('อัปเดตโค้ด') || t.includes('update code') ||
    t.includes('ช่วยแก้')
  );
}

// ── Call OpenRouter ──────────────────────────────────────────────────────
async function callOpenRouter(apiKey, messages, maxTokens) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Workflow',
    },
    body: JSON.stringify({
      model: process.env.DEFAULT_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens || 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── Fetch file from GitHub repo ─────────────────────────────────────────
async function fetchRepoFile(pat, filePath, ref) {
  const url = `${GH_API}/repos/${GH_REPO}/contents/${filePath}${ref ? '?ref=' + ref : ''}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CHINCHA-FLOW-AI',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub fetch ${res.status} for ${filePath}`);
  const data = await res.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
    path: filePath,
  };
}

// ── List repo files matching a glob pattern (simple) ────────────────────
const REPO_FILE_LIST = [
  'apps/seafood-pos/src/', 'apps/chincha-tea/src/',
  'apps/webhook-core/src/', 'package.json', 'firebase.json', '.firebaserc',
];

// ── Code-action system prompt ────────────────────────────────────────────
const CODE_ACTION_PROMPT = `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ของ CHINCHA FLOW monorepo
คุณกำลังแก้โค้ดตามคำสั่งของพี่ (เจ้าของร้าน)

โครงสร้าง repo:
- apps/chincha-tea: ร้านชินชา Tea POS (Vite/React)
- apps/seafood-pos: โกอ้วนซีฟู้ด Shrimp POS (Vite/React)
- apps/webhook-core: Cloud Functions (Node 20, firebase-functions)
- Firebase project: chincha-eeed6

กฎ:
1. diff เล็กที่สุด — แก้เฉพาะที่จำเป็น
2. ใช้ convention เดิม (อย่าเปลี่ยน style ถ้าไม่จำเป็น)
3. ห้าม expose secret, key, token ในโค้ด
4. ภาษาไทยหรืออังกฤษใน commit message ได้

ตอบกลับในรูปแบบนี้เท่านั้น (JSON ใน code block):

\`\`\`json
{
  "branch": "dev/ชื่อสั้น-อธิบายงาน",
  "commit": "feat/fix: อธิบายสั้น (สูงสุด 72 ตัวอักษร)",
  "changes": [
    {
      "path": "apps/seafood-pos/src/lib/example.js",
      "action": "replace",
      "old": "โค้ดเดิมที่จะถูกแทนที่ (3-5 บรรทัดพอบอกตำแหน่ง)",
      "new": "โค้ดใหม่ทั้งหมดที่จะใส่แทน"
    },
    {
      "path": "apps/chincha-tea/src/App.jsx",
      "action": "patch",
      "find": "บรรทัดในไฟล์ที่อยู่ก่อนจุดแทรก",
      "insert": "โค้ดใหม่ที่เพิ่มเข้าไป"
    }
  ],
  "pr_title": "ชื่อ PR",
  "pr_body": "อธิบายว่าแก้ไขอะไร ทำไม"
}
\`\`\`
`;

// ── Apply code changes via GitHub API ────────────────────────────────────
async function applyCodeChanges(pat, changePlan) {
  const branchName = changePlan.branch || 'dev/ai-fix-' + Date.now().toString(36);
  const commitMsg = changePlan.commit || 'fix: AI fix';
  const changes = changePlan.changes || [];

  if (changes.length === 0) throw new Error('ไม่มีไฟล์ที่จะแก้');

  // Step 1: Get main SHA
  const mainRefRes = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/main`, {
    headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
  });
  if (!mainRefRes.ok) throw new Error(`GitHub ref fetch ${mainRefRes.status}`);
  const mainRef = await mainRefRes.json();
  const mainSha = mainRef.object.sha;

  // Step 2: Create branch from main
  const branchRes = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs`, {
    method: 'POST',
    headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
  });
  if (branchRes.status !== 201) {
    // Branch might already exist — get its SHA
    const existing = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/${branchName}`, {
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
    });
    if (!existing.ok) throw new Error(`GitHub branch create failed ${branchRes.status}`);
    const exRef = await existing.json();
    // Reset branch to main
    await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/${branchName}`, {
      method: 'PATCH',
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
      body: JSON.stringify({ sha: mainSha, force: true }),
    });
  }

  // Step 3: Read current file contents from main
  const fileContents = {};
  for (const change of changes) {
    if (!change.path) continue;
    const file = await fetchRepoFile(pat, change.path, 'main');
    if (file) {
      fileContents[change.path] = file;
    } else if (change.action === 'create') {
      fileContents[change.path] = { content: '', sha: null, path: change.path };
    }
  }

  // Step 4: Apply changes
  for (const change of changes) {
    const file = fileContents[change.path];
    let newContent;

    if (change.action === 'create') {
      newContent = change.new || change.content || '';
    } else if (change.action === 'replace') {
      if (!file || !file.content) throw new Error(`ไม่พบไฟล์ ${change.path}`);
      // Find old content and replace
      if (change.old && file.content.includes(change.old)) {
        newContent = file.content.replace(change.old, change.new || '');
      } else {
        // If old not found exactly, try line-based approach or use full replace
        newContent = change.new || file.content;
      }
    } else if (change.action === 'patch') {
      if (!file || !file.content) throw new Error(`ไม่พบไฟล์ ${change.path}`);
      if (change.find && file.content.includes(change.find)) {
        const idx = file.content.indexOf(change.find) + change.find.length;
        newContent = file.content.slice(0, idx) + '\n' + (change.insert || '') + file.content.slice(idx);
      } else {
        newContent = file.content + '\n' + (change.insert || '');
      }
    } else {
      newContent = change.new || change.content || (file ? file.content : '');
    }

    // Step 5: Commit the file via GitHub API
    const commitBody = {
      message: commitMsg,
      content: Buffer.from(newContent).toString('base64'),
      branch: branchName,
      committer: { name: 'เด๊ฟ (AI)', email: ADMIN_EMAIL },
    };
    if (file && file.sha) commitBody.sha = file.sha;

    const commitRes = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${change.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CF-AI',
      },
      body: JSON.stringify(commitBody),
    });
    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      throw new Error(`GitHub commit ${change.path} failed: ${commitRes.status} ${err.message || ''}`);
    }
  }

  return branchName;
}

// ── Open a PR ────────────────────────────────────────────────────────────
async function openPR(pat, branchName, prTitle, prBody) {
  const res = await fetch(`${GH_API}/repos/${GH_REPO}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CF-AI',
    },
    body: JSON.stringify({
      title: prTitle || `AI Fix: ${branchName}`,
      head: branchName,
      base: 'main',
      body: prBody || `Auto-generated by เด๊ฟ (AI Workflow Agent)\n\nBranch: ${branchName}`,
      draft: false,
    }),
  });

  if (!res.ok) {
    // PR might exist — try to list
    const existing = await fetch(`${GH_API}/repos/${GH_REPO}/pulls?head=peachtukta1014:${branchName}&state=open`, {
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
    });
    if (existing.ok) {
      const prs = await existing.json();
      if (prs.length > 0) return prs[0].html_url;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PR create failed: ${res.status} ${err.message || ''}`);
  }

  const pr = await res.json();
  return pr.html_url;
}

// ── Main handler ─────────────────────────────────────────────────────────
async function executeCodeAction(openRouterKey, ghPat, { message, history, scope }) {
  // Step 1: Get relevant files from repo
  const scopeDirs = {
    seafood: ['apps/seafood-pos/src/'],
    tea: ['apps/chincha-tea/src/'],
    webhook: ['apps/webhook-core/src/'],
    root: ['apps/seafood-pos/src/', 'apps/chincha-tea/src/', 'apps/webhook-core/src/'],
    scheduled: ['apps/webhook-core/src/'],
  };
  const dirs = scopeDirs[scope] || scopeDirs.root;

  // Step 2: Build the AI prompt with context
  let contextSnippets = '';
  for (const dir of dirs.slice(0, 3)) {
    try {
      // Try to fetch a key file from each dir
      let keyFile = 'index.js';
      if (dir.includes('seafood')) keyFile = 'apps/seafood-pos/src/lib/salesAggregate.js';
      if (dir.includes('tea')) keyFile = 'apps/chincha-tea/src/App.jsx';
      const file = await fetchRepoFile(ghPat, keyFile, 'main');
      if (file && file.content) {
        contextSnippets += `\n--- ${keyFile} (first 100 lines) ---\n${file.content.slice(0, 2000)}\n`;
      }
    } catch { /* skip unavailable files */ }
  }

  const systemPrompt = CODE_ACTION_PROMPT + '\n\n=== บริบทโค้ดปัจจุบัน (บางส่วน) ===\n' + contextSnippets;

  const aiMessages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-5),
    { role: 'user', content: `คำสั่ง: ${message}\nScope: ${scope}\n\nวิเคราะห์คำสั่งนี้ อ่านโค้ดที่ให้มา แล้วสร้างแผนแก้โค้ดในรูปแบบ JSON ตามที่ระบุไว้` },
  ];

  // Step 3: Call OpenRouter to get the fix plan
  const aiResponse = await callOpenRouter(openRouterKey, aiMessages, 4096);

  // Step 4: Parse JSON from response
  const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON fix plan: ' + aiResponse.slice(0, 200));
  }

  const changePlan = JSON.parse(jsonMatch[1] || jsonMatch[0]);

  // Step 5: Apply changes via GitHub API
  const branchName = await applyCodeChanges(ghPat, changePlan);

  // Step 6: Open PR
  const prUrl = await openPR(ghPat, branchName, changePlan.pr_title, changePlan.pr_body);

  return { branchName, prUrl, changePlan };
}

// ── Direct handler for aiChatAgent.js ────────────────────────────────────
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

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return {
      statusCode: 500,
      body: {
        reply: 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า',
        scope: scope || 'root',
        intent: 'code-action',
        status: 'config_error',
      },
    };
  }

  const ghPat = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!ghPat) {
    return {
      statusCode: 500,
      body: {
        reply: 'GH_PAT ไม่ได้ตั้งค่า — ต้องมี GitHub Personal Access Token เพื่อสร้าง PR',
        scope: scope || 'root',
        intent: 'code-action',
        status: 'config_error',
      },
    };
  }

  const currentScope = scope || 'root';

  try {
    const result = await executeCodeAction(openRouterKey, ghPat, {
      message,
      history: history || [],
      scope: currentScope,
    });

    return {
      statusCode: 200,
      body: {
        reply: `PR แล้วครับ! ${result.prUrl}\n\nBranch: ${result.branchName}\n\nAI (deepseek) วิเคราะห์คำสั่ง → แก้โค้ด → สร้าง branch → commit → เปิด PR สำเร็จ\n\nรัน smoke test + build แล้ว merge ได้เลย`,
        scope: currentScope,
        intent: 'code-action',
        status: 'completed',
        prUrl: result.prUrl,
        branchName: result.branchName,
      },
    };
  } catch (err) {
    console.error('handleCodeAction error:', err);
    return {
      statusCode: 500,
      body: {
        reply: 'เกิดข้อผิดพลาด: ' + (err.message || 'unknown') + '\n\nAI อาจสร้าง JSON ไม่ถูกต้อง — ลองอธิบายให้ชัดขึ้นหรือระบุไฟล์ที่ต้องการแก้',
        scope: currentScope,
        intent: 'code-action',
        status: 'error',
        error: err.message || 'unknown',
      },
    };
  }
}

// ── V1 onRequest — HTTP endpoint ─────────────────────────────────────────
exports.aiWorkflowAgentHttp = functions
  .runWith({ memory: '512MB', timeoutSeconds: 120 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    const result = await handleCodeAction(req.body || {});
    res.status(result.statusCode).json(result.body);
  });

exports.handleCodeAction = handleCodeAction;

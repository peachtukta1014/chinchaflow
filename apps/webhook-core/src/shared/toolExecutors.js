/**
 * toolExecutors.js — GitHub file helpers + executeTool สำหรับ จีจี้ Agentic Loop
 */

const { execSync } = require('child_process');
const { GH_API, GH_REPO, ADMIN_EMAIL, AGENT_MODEL } = require('./toolDefinitions');

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
async function executeTool(name, args, { ghPat, scopeFileTree, stagedFiles, isHighRisk }) {
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
        // Re-fetch current SHA from the branch to avoid stale SHA mismatches
        let liveSha = (await fetchRepoFile(ghPat, filePath, branchName).catch(() => null))?.sha || null;

        let commitRes;
        for (let attempt = 0; attempt < 2; attempt++) {
          const commitBody = {
            message: commitMsg,
            content: Buffer.from(fileData.content).toString('base64'),
            branch: branchName,
            committer: { name: 'V4-Pro (AI)', email: ADMIN_EMAIL },
          };
          if (liveSha) commitBody.sha = liveSha;

          commitRes = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${filePath}`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
            body: JSON.stringify(commitBody),
          });

          if (commitRes.ok) break;

          const errData = await commitRes.json().catch(() => ({}));
          // SHA mismatch — re-fetch live SHA and retry once
          if (attempt === 0 && (commitRes.status === 409 || (errData.message || '').includes('does not match'))) {
            liveSha = (await fetchRepoFile(ghPat, filePath, branchName).catch(() => null))?.sha || null;
            continue;
          }
          throw new Error(`commit ${filePath} ล้มเหลว: ${errData.message || commitRes.status}`);
        }
        committed.push(filePath);
      }

      // Auto-add changelog entry — ข้ามถ้า Pro อัปเดต changelog เองแล้ว (ป้องกัน entry ซ้ำ)
      try {
        const changelog = !committed.includes('docs/AGENT_CHANGELOG_TH.md')
          ? await fetchRepoFile(ghPat, 'docs/AGENT_CHANGELOG_TH.md', branchName)
          : null;
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
                committer: { name: 'V4-Pro (AI)', email: ADMIN_EMAIL },
              }),
            });
          }
        }
      } catch { /* changelog failure is non-fatal */ }

      // Open PR
      const riskNote = isHighRisk
        ? `_⚠️ high-risk: กระทบ logic/ราคา/สต๊อก/โครงสร้างหลัก — **ตรวจสอบก่อน merge** นะครับพี่_`
        : `_⚡ low-risk: ตรวจสอบ CI ผ่านแล้วค่อย merge ได้เลยครับพี่_`;
      const autoMergeTag = '';
      const prBodyFull = (args.pr_body || '') +
        `\n\n---\n**ไฟล์ที่แก้:** ${committed.join(', ')}\n` +
        riskNote + autoMergeTag;

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

      const mergeMsg = isHighRisk
        ? `⚠️ งานนี้กระทบส่วนสำคัญ — ตรวจดูก่อน merge นะครับพี่ 🙏`
        : `⚡ low-risk — ตรวจสอบ CI ผ่านแล้วค่อย merge ได้เลยครับพี่ 🌸`;
      return `✅ เปิด PR แล้วครับพี่! ${prUrl}\n\n${mergeMsg}\nBranch: ${branchName}\nไฟล์ที่แก้: ${committed.join(', ')}`;
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
        'auto-shrimp': '.claude/commands/auto-shrimp.md',
        'auto-tea': '.claude/commands/auto-tea.md',
        'ship-shrimp': '.claude/commands/ship-shrimp.md',
        'ship-tea': '.claude/commands/ship-tea.md',
        'land-it': '.claude/commands/land-it.md',
        'peter-ser': '.claude/commands/peter-ser.md',
      };
      const skillPath = skillPaths[args.name];
      if (!skillPath) return `❌ ไม่รู้จัก skill "${args.name}"`;
      const file = await fetchRepoFile(ghPat, skillPath);
      if (!file) return `❌ ไม่พบไฟล์ skill: ${skillPath}`;
      return `=== Skill: ${args.name} (${skillPath}) ===\n${file.content}\n\n` +
        `ℹ️ Pro รันใน GitHub Actions runner — repo checkout พร้อม, git/npm/node ใช้ได้ผ่าน exec_command ` +
        `(timeout สูงสุด 300 วิ) อ่าน skill นี้เพื่อเข้าใจขั้นตอน แล้วใช้ tool จริง ` +
        `(read_file, patch_file, write_file, commit_and_pr, exec_command) ดำเนินงานต่อ`;
    }

    case 'exec_command': {
      // รันใน GitHub Actions runner — มี repo checkout เต็ม, git/npm/node พร้อมใช้
      const timeoutSec = Math.min(Number(args.timeout_seconds) || 30, 300);
      try {
        const output = execSync(args.command, {
          timeout: timeoutSec * 1000,
          encoding: 'utf8',
          maxBuffer: 2 * 1024 * 1024,
        });
        return `✅ output:\n${output.trim() || '(ไม่มี output)'}`;
      } catch (err) {
        if (err.killed || err.signal === 'SIGTERM') {
          return `❌ timeout (>${timeoutSec}วิ): command ใช้เวลานานเกินไป — ลอง timeout_seconds ที่มากขึ้น หรือแบ่งคำสั่งสั้นลง`;
        }
        const msg = ((err.stdout || '') + (err.stderr || '') || err.message).slice(0, 2000);
        return `❌ error (exit ${err.status}):\n${msg}`;
      }
    }

    case 'report_no_action_needed': {
      const prefix = args.need_more_info ? 'ขอข้อมูลเพิ่มก่อนนะครับพี่ 🙏' : 'รายงานผลครับพี่';
      return `ℹ️ ${prefix}\n\n${args.summary || ''}`;
    }

    default:
      return `❌ ไม่รู้จัก tool "${name}" — tools ที่มี: read_file, list_files, search_code, patch_file, write_file, commit_and_pr, trigger_deploy, get_skill, exec_command, report_no_action_needed`;
  }
}

module.exports = { fetchRepoFile, executeTool };

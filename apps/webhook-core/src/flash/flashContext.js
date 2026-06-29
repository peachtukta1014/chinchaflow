// Firestore loaders for Flash (จีจี้) — project tree, custom notes, agent docs
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const DOCS_TTL_MS = 10 * 60 * 1000;
const PROJECT_TREE_TTL = 5 * 60_000;

let _projectTreeCache = null;
let _projectTreeCachedAt = 0;
let _agentDocsCache = null;
let _agentDocsCachedAt = 0;

function _fsDb() {
  if (!admin.apps.length) admin.initializeApp();
  return getFirestore();
}

async function loadProjectTree() {
  const now = Date.now();
  if (_projectTreeCache && now - _projectTreeCachedAt < PROJECT_TREE_TTL) {
    return _projectTreeCache;
  }
  try {
    const snap = await _fsDb().collection('systemConfig').doc('projectTree').get();
    _projectTreeCache = snap.data()?.tree || '';
    _projectTreeCachedAt = now;
  } catch { /* ใช้ cache เก่าถ้า Firestore ไม่ตอบ */ }
  return _projectTreeCache || '';
}

// ไม่มี cache — พีชแก้จาก UI ต้องอ่านทุกครั้งเพื่อให้ real-time
async function loadCustomNotes() {
  try {
    const snap = await _fsDb().collection('systemConfig').doc('customNotes').get();
    return snap.data()?.notes || '';
  } catch { return ''; }
}

async function loadAgentDocs() {
  const now = Date.now();
  if (_agentDocsCache && now - _agentDocsCachedAt < DOCS_TTL_MS) return _agentDocsCache;
  try {
    const snap = await _fsDb().collection('systemConfig').doc('agentDocs').get();
    _agentDocsCache = snap.data()?.files || {};
    _agentDocsCachedAt = now;
  } catch { /* ใช้ cache เก่าถ้า Firestore ไม่ตอบ */ }
  return _agentDocsCache || {};
}

async function fetchJiijiDef() {
  const files = await loadAgentDocs();
  return (files['FLASH.md'] || '').slice(0, 3500);
}

async function fetchChatAgentDocs() {
  const files = await loadAgentDocs();
  const list = [
    { path: 'AGENTS.md', label: 'กฎ monorepo + กฎแต่ละแอป', maxLen: 6000 },
    { path: 'docs/PROJECT_STRUCTURE.md', label: 'โครงสร้างไฟล์ repo', maxLen: 5000 },
    { path: 'docs/AGENT_CHANGELOG_TH.md', label: 'changelog ล่าสุด (แก้อะไรไปแล้ว)', maxLen: 5000 },
    { path: 'docs/PEACH_WORKING_STYLE_TH.md', label: 'สไตล์การทำงานของพี่พีช', maxLen: 5000 },
    { path: 'docs/AGENT_HANDBOOK_TH.md', label: 'คู่มือ agent + แผนที่ repo', maxLen: 5000 },
  ];
  let result = '';
  for (const f of list) {
    const content = files[f.path];
    if (content) result += `\n\n=== ${f.label} (${f.path}) ===\n${content.slice(0, f.maxLen)}\n`;
  }
  return result;
}

async function fetchCodeMetrics() {
  const files = await loadAgentDocs();
  return files['docs/CODE_METRICS.md'] || null;
}

const GITHUB_OWNER = 'peachtukta1014';
const GITHUB_REPO = 'chinchaflow';
const FETCH_FILE_MAX_CHARS = 3000;
const FETCH_FILE_MAX_COUNT = 5;

async function fetchRepoFiles(pat, filePaths) {
  if (!pat || !Array.isArray(filePaths) || filePaths.length === 0) return {};
  const results = {};
  await Promise.all(
    filePaths.slice(0, FETCH_FILE_MAX_COUNT).map(async (filePath) => {
      try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'CHINCHA-FLOW-Flash',
          },
        });
        if (res.ok) {
          const text = await res.text();
          results[filePath] = text.slice(0, FETCH_FILE_MAX_CHARS);
        }
      } catch { /* skip ไฟล์ที่อ่านไม่ได้ */ }
    })
  );
  return results;
}

module.exports = { loadProjectTree, loadCustomNotes, loadAgentDocs, fetchJiijiDef, fetchChatAgentDocs, fetchCodeMetrics, fetchRepoFiles };

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

// อ่าน pointer "งานล่าสุดของ scope นี้" (เขียนโดย Pro — writeLastRunStatus ใน progressTracker.js)
// ไม่มี cache — ต้องเห็นสถานะล่าสุดจริงเสมอ ไม่งั้น Flash อาจพลาดเห็น error รอบก่อนที่เพิ่งเกิด
async function loadLastExecutionStatus(scope) {
  if (!scope) return null;
  try {
    const snap = await _fsDb().collection('systemConfig').doc('lastRunByScope').get();
    return snap.data()?.[scope] || null;
  } catch { return null; }
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
    { path: 'docs/AI_AGENT_SYSTEM.md', label: 'สถาปัตยกรรม AI ครบชุด (Flash/Pro/scopes/keys)', maxLen: 4000 },
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
const FETCH_FILE_MAX_COUNT = 5;

// GH_PAT_READ ต้องเป็น read-only เท่านั้น (Contents: Read + Actions: Read)
// ห้ามใช้ token นี้สำหรับ write/create/delete — Flash อ่านโค้ดล่วงหน้าเท่านั้น
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
          results[filePath] = text;
        }
      } catch { /* skip ไฟล์ที่อ่านไม่ได้ */ }
    })
  );
  return results;
}

// pendingActions/{requestId} — เก็บ Task Brief ระหว่างรอพีชพิมพ์ "ไฟเขียว"
const PENDING_ACTION_TTL_MS = 15 * 60 * 1000; // 15 นาที

async function savePendingAction(requestId, data) {
  const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS);
  await _fsDb().collection('pendingActions').doc(requestId).set({ ...data, expiresAt });
}

async function loadPendingAction(requestId) {
  if (!requestId) return null;
  try {
    const snap = await _fsDb().collection('pendingActions').doc(requestId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (data.expiresAt?.toDate() < new Date()) {
      snap.ref.delete().catch(() => {});
      return null;
    }
    return data;
  } catch { return null; }
}

async function clearPendingAction(requestId) {
  if (!requestId) return;
  await _fsDb().collection('pendingActions').doc(requestId).delete().catch(() => {});
}

const VALID_SCOPES = ['seafood', 'tea', 'webhook', 'scheduled', 'root'];

async function fetchScopeSkill(pat, scope) {
  if (!pat || !VALID_SCOPES.includes(scope)) return '';
  const path = `.skill/scope-${scope}.md`;
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${pat}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'CHINCHA-FLOW-Flash',
      },
    });
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, 2000);
  } catch { return ''; }
}

// ── Investigation State (Detective Case File per requestId) ───────────────
// เก็บถาวรใน Firestore collection 'investigations' — UI KnowledgePanel อ่านได้, query ย้อนหลังได้

async function saveInvestigationState(requestId, state) {
  if (!requestId) return;
  try {
    await _fsDb().collection('investigations').doc(requestId).set(
      { ...state, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    console.warn('saveInvestigationState error:', err.message);
  }
}

async function loadInvestigationState(requestId) {
  if (!requestId) return null;
  try {
    const snap = await _fsDb().collection('investigations').doc(requestId).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

// เก็บสรุปการสืบสวนถาวร (เรียกหลัง finalize สำเร็จ)
async function archiveInvestigation(requestId, summary) {
  if (!requestId) return;
  try {
    await _fsDb().collection('investigations').doc(requestId).set(
      { archive: summary, archivedAt: Date.now(), status: 'completed' },
      { merge: true }
    );
  } catch (err) {
    console.warn('archiveInvestigation error:', err.message);
  }
}

module.exports = { loadProjectTree, loadCustomNotes, loadAgentDocs, fetchJiijiDef, fetchChatAgentDocs, fetchCodeMetrics, fetchRepoFiles, fetchScopeSkill, savePendingAction, loadPendingAction, clearPendingAction, loadLastExecutionStatus, saveInvestigationState, loadInvestigationState, archiveInvestigation };

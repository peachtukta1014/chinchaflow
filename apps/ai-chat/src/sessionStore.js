// ── Session storage (localStorage) ─────────────────────────────────────
// บันทึกประวัติแชทแต่ละ session ลง localStorage
// Key: 'jiiji_sessions' → array ของ session objects (เรียงจากใหม่→เก่า)

const STORAGE_KEY = 'jiiji_sessions';
const MAX_SESSIONS = 30;

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveAll(sessions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
  catch { /* storage full — ignore */ }
}

export function listSessions() {
  return loadAll();
}

export function createSession({ firstMessage, scope }) {
  const id = 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const title = (firstMessage || 'แชทใหม่').slice(0, 40) + ((firstMessage || '').length > 40 ? '...' : '');
  const now = Date.now();
  const session = { id, title, scope, createdAt: now, updatedAt: now, messages: [] };
  let all = loadAll();
  all.unshift(session);
  if (all.length > MAX_SESSIONS) all = all.slice(0, MAX_SESSIONS);
  saveAll(all);
  return id;
}

export function updateSession(id, messages, scope) {
  const all = loadAll();
  const idx = all.findIndex(s => s.id === id);
  if (idx === -1) return;
  // ไม่เก็บ imageUrls (ประหยัด storage)
  const stored = messages.map(m => ({ role: m.role, content: m.content }));
  const updated = { ...all[idx], messages: stored, scope, updatedAt: Date.now() };
  all.splice(idx, 1);
  all.unshift(updated);
  saveAll(all);
}

export function deleteSession(id) {
  saveAll(loadAll().filter(s => s.id !== id));
}

export function getSession(id) {
  return loadAll().find(s => s.id === id) || null;
}

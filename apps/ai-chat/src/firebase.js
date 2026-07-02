// Firebase helpers — Auth ใช้ SDK, Firestore ใช้ REST (pattern เดียวกับ seafood-pos/chincha-tea)
// เหตุผล: Firestore SDK ใช้ WebChannel streaming ซึ่งโดนบล็อกบน iOS PWA (Add to Home Screen)
// ทำให้ getDoc/onSnapshot พัง error 'unavailable' ตลอด — auto-detect long polling ก็ไม่ช่วย
// (SDK v10 เปิด auto-detect เป็น default อยู่แล้ว) ส่วน REST เป็น fetch() ธรรมดา ไม่โดนบล็อก
// พิสูจน์แล้วจากแอปกุ้ง/ชา (firestoreRest.js) ที่ใช้งานบน iPhone พีชได้ปกติ
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const ALLOWED_EMAIL = 'peachtukta1014@gmail.com';

let _app = null;

function getApp() {
  if (_app) return _app;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  // 💡 ป้องกันกรณีเอเจ้นเขียนโค้ดเพี้ยน หรือติดเครื่องหมาย < > / ขึ้นบรรทัดใหม่มาจากตัวบิลด์
  let authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  if (authDomain) {
    authDomain = authDomain.replace(/[<>\s]/g, '').trim();
  }

  if (!apiKey || !projectId) return null;

  // ใช้ค่า authDomain ที่ถูกกรองจนสะอาดแล้ว
  _app = getApps()[0] ?? initializeApp({ apiKey, projectId, authDomain });
  return _app;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const app = getApp();
  if (!app) throw new Error('Firebase not configured');
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  // ช่วย Hint อีเมลของพีชไว้ล่วงหน้าตอนหน้าต่าง Google Pop-up เด้งขึ้นมา
  provider.setCustomParameters({ login_hint: ALLOWED_EMAIL });

  const result = await signInWithPopup(auth, provider);

  // ระบบล็อกความปลอดภัยสูงสุด — ถ้าไม่ใช่เมลพีช ระบบจะเตะออกทันที
  if (result.user.email !== ALLOWED_EMAIL) {
    await signOut(auth);
    throw new Error('ไม่ได้รับอนุญาต — ใช้บัญชี peachtukta1014@gmail.com เท่านั้น');
  }
  return result.user;
}

export async function signOutUser() {
  const app = getApp();
  if (!app) return;
  await signOut(getAuth(app));
}

export function onAuthChanged(callback) {
  const app = getApp();
  if (!app) { callback(null); return () => {}; }
  return onAuthStateChanged(getAuth(app), callback);
}

// ── Firestore REST helpers ───────────────────────────────────────────────────
function fsBase() {
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) return null;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

// ?key= จำเป็นสำหรับ REST — ถ้าไม่มีทั้ง key และ Bearer token, Google ปฏิเสธ 403
// ก่อนถึง security rules (web API key เป็นค่า public โดย design ไม่ใช่ secret)
function fsKeyQuery() {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  return apiKey ? `key=${apiKey}` : '';
}

async function fsAuthHeaders() {
  const base = { 'Content-Type': 'application/json' };
  const app = getApp();
  const user = app ? getAuth(app).currentUser : null;
  if (!user) return base;
  try {
    const token = await user.getIdToken();
    return { ...base, Authorization: `Bearer ${token}` };
  } catch {
    return base;
  }
}

function fsDecode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(fsDecode);
  if ('mapValue' in v) return fsFields(v.mapValue?.fields);
  return null;
}

function fsFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([k, v]) => [k, fsDecode(v)]),
  );
}

/** อ่านเอกสาร 1 ตัว — คืน fields เป็น JS object, คืน null ถ้าเอกสารไม่มี (404) */
async function fsGetDoc(path) {
  const base = fsBase();
  if (!base) throw new Error('Firebase not configured — ตรวจสอบ VITE_FIREBASE_PROJECT_ID');
  const k = fsKeyQuery();
  const res = await fetch(`${base}/${path}${k ? `?${k}` : ''}`, { headers: await fsAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
  const doc = await res.json();
  return fsFields(doc.fields);
}

/** poll เอกสารซ้ำๆ แทน onSnapshot — คืน unsubscribe แบบเดียวกับ SDK */
function pollDoc(path, intervalMs, onData, label) {
  let stopped = false;
  const tick = async () => {
    try {
      const data = await fsGetDoc(path);
      if (!stopped) onData(data);
    } catch (err) {
      console.warn(`[Firebase] ${label}:`, err.message);
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => { stopped = true; clearInterval(timer); };
}

// ── Pro Agent progress (poll แทน onSnapshot) ─────────────────────────────────
export function listenProgress(requestId, onStep) {
  return pollDoc(
    `aiProgress/${requestId}`,
    2500,
    (data) => { onStep(data ? (data.step || null) : null); },
    'listenProgress',
  );
}

// ── Pro Agent result (poll แทน onSnapshot) ───────────────────────────────────
export function listenForResult(requestId, onResult) {
  return pollDoc(
    `aiResults/${requestId}`,
    3000,
    (data) => { if (data) onResult(data); },
    'listenForResult',
  );
}

// ── systemConfig helpers ─────────────────────────────────────────────────────
export async function getProjectTree() {
  const data = await fsGetDoc('systemConfig/projectTree');
  return data?.tree || '';
}

export async function getAgentDocs() {
  const data = await fsGetDoc('systemConfig/agentDocs');
  return data?.files || {};
}

export async function getCustomNotes() {
  try {
    const data = await fsGetDoc('systemConfig/customNotes');
    return data?.notes || '';
  } catch { return ''; }
}

export async function saveCustomNotes(notes) {
  const base = fsBase();
  if (!base) throw new Error('Firebase not configured');
  const k = fsKeyQuery();
  const res = await fetch(
    `${base}/systemConfig/customNotes?updateMask.fieldPaths=notes&updateMask.fieldPaths=updatedAt${k ? `&${k}` : ''}`,
    {
      method: 'PATCH',
      headers: await fsAuthHeaders(),
      body: JSON.stringify({
        fields: {
          notes: { stringValue: notes },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`บันทึกไม่สำเร็จ (Firestore REST ${res.status})`);
}

// ── Token logs — poll ทุก 30 วิ (dashboard ไม่ต้อง real-time เป๊ะ) ─────────────
export function listenTokenLogs(onLogs, maxCount = 200) {
  let stopped = false;
  let everSucceeded = false;
  const tick = async () => {
    try {
      const base = fsBase();
      if (!base) { if (!stopped) onLogs([]); return; }
      const k = fsKeyQuery();
      const res = await fetch(`${base}:runQuery${k ? `?${k}` : ''}`, {
        method: 'POST',
        headers: await fsAuthHeaders(),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'tokenLogs' }],
            orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
            limit: maxCount,
          },
        }),
      });
      if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
      const rows = await res.json();
      const logs = (Array.isArray(rows) ? rows : [])
        .filter((r) => r.document)
        .map((r) => ({ id: r.document.name.split('/').pop(), ...fsFields(r.document.fields) }));
      everSucceeded = true;
      if (!stopped) onLogs(logs);
    } catch (err) {
      console.warn('[TokenLogs] poll error:', err.message);
      // error ครั้งแรก → ส่ง [] ให้ UI ออกจาก loading, error รอบหลัง → คงข้อมูลเดิมไว้
      if (!stopped && !everSucceeded) onLogs([]);
    }
  };
  tick();
  const timer = setInterval(tick, 30000);
  return () => { stopped = true; clearInterval(timer); };
}

// Firebase helpers — Firestore + Google Auth
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  doc,
  collection,
  onSnapshot,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const ALLOWED_EMAIL = 'peachtukta1014@gmail.com';

let _app = null;
let _db = null;

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

function getDb() {
  if (_db) return _db;
  const app = getApp();
  if (!app) return null;
  // PWA บน iOS (Add to Home Screen) มักบล็อก WebChannel streaming ของ Firestore
  // ค่า default ทำให้ onSnapshot/getDoc ค้างแล้วโดน error 'unavailable' ตลอด (ยิง fetch()
  // ธรรมดาอย่าง aiChatAgentHttp ไม่โดนเพราะไม่ใช้ transport เดียวกัน) — บังคับ auto-detect
  // long polling แก้ปัญหานี้โดยตรง ตาม Firebase docs สำหรับ network/webview ที่จำกัด
  _db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
  return _db;
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

// ── Pro Agent progress (onSnapshot event-driven) ─────────────────────────────
export function listenProgress(requestId, onStep) {
  const db = getDb();
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'aiProgress', requestId),
    (snap) => { onStep(snap.exists() ? (snap.data()?.step || null) : null); },
    (err) => console.warn('[Firebase] listenProgress:', err.code)
  );
}

// ── Pro Agent result (onSnapshot event-driven) ───────────────────────────────
export function listenForResult(requestId, onResult) {
  const db = getDb();
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'aiResults', requestId),
    (snap) => { if (snap.exists()) onResult(snap.data()); },
    (err) => console.warn('[Firebase] listenForResult:', err.code)
  );
}

// ── systemConfig helpers ─────────────────────────────────────────────────────
export async function getProjectTree() {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured — ตรวจสอบ VITE_FIREBASE_API_KEY และ VITE_FIREBASE_PROJECT_ID');
  const snap = await getDoc(doc(db, 'systemConfig', 'projectTree'));
  return snap.exists() ? (snap.data()?.tree || '') : '';
}

export async function getAgentDocs() {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(db, 'systemConfig', 'agentDocs'));
  return snap.exists() ? (snap.data()?.files || {}) : {};
}

export async function getCustomNotes() {
  const db = getDb();
  if (!db) return '';
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'customNotes'));
    return snap.exists() ? (snap.data()?.notes || '') : '';
  } catch { return ''; }
}

export async function saveCustomNotes(notes) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  await setDoc(doc(db, 'systemConfig', 'customNotes'), {
    notes,
    updatedAt: serverTimestamp(),
  });
}

// ── Token logs — real-time listener (onSnapshot ใช้ offline cache ทนเน็ตไม่ดี) ──
export function listenTokenLogs(onLogs, maxCount = 200) {
  const db = getDb();
  if (!db) { onLogs([]); return () => {}; }
  const q = query(
    collection(db, 'tokenLogs'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  return onSnapshot(
    q,
    snap => onLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn('[TokenLogs] listener error:', err.code); onLogs([]); }
  );
}
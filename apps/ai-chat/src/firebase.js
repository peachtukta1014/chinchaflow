// Firebase Firestore helpers — ใช้ onSnapshot + get/set โดยตรง
// ต้องการเฉพาะ VITE_FIREBASE_API_KEY + VITE_FIREBASE_PROJECT_ID
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

let _db = null;

function getDb() {
  if (_db) return _db;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  const app = getApps()[0] ?? initializeApp({ apiKey, projectId });
  _db = getFirestore(app);
  return _db;
}

// ── Pro Agent result (onSnapshot event-driven) ───────────────────────────────
export function listenForResult(requestId, onResult) {
  const db = getDb();
  if (!db) return null;
  return onSnapshot(
    doc(db, 'aiResults', requestId),
    (snap) => { if (snap.exists()) onResult(snap.data()); },
    (err) => console.warn('[Firebase] listenForResult:', err.code)
  );
}

// ── systemConfig helpers ─────────────────────────────────────────────────────
export async function getProjectTree() {
  const db = getDb();
  if (!db) return '';
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'projectTree'));
    return snap.exists() ? (snap.data()?.tree || '') : '';
  } catch { return ''; }
}

export async function getAgentDocs() {
  const db = getDb();
  if (!db) return {};
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'agentDocs'));
    return snap.exists() ? (snap.data()?.files || {}) : {};
  } catch { return {}; }
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

// ── Token logs ───────────────────────────────────────────────────────────────
export async function getRecentTokenLogs(maxCount = 20) {
  const db = getDb();
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'tokenLogs'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

// Firebase Firestore listener — ใช้ onSnapshot แทน polling
// ต้องการเฉพาะ VITE_FIREBASE_API_KEY + VITE_FIREBASE_PROJECT_ID
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

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

// ฟังผลลัพธ์จาก Pro Agent ใน aiResults/{requestId}
// คืนค่า unsubscribe fn (หรือ null ถ้า Firebase ไม่ได้ตั้งค่า)
export function listenForResult(requestId, onResult) {
  const db = getDb();
  if (!db) return null;
  return onSnapshot(
    doc(db, 'aiResults', requestId),
    (snap) => { if (snap.exists()) onResult(snap.data()); },
    (err) => console.warn('[Firebase] listenForResult:', err.code)
  );
}

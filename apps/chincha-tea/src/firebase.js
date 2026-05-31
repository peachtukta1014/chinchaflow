import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { viteEnv } from './lib/viteEnv.js';

export const firebaseConfig = {
  apiKey: viteEnv('VITE_FIREBASE_API_KEY'),
  authDomain: viteEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: viteEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: viteEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: viteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: viteEnv('VITE_FIREBASE_APP_ID'),
};

const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
export const fbReady = required.every((k) => Boolean(firebaseConfig[k]));

/** ใช้ default app — กัน getIdToken() หา [DEFAULT] ไม่เจอ (เคยตั้งชื่อ chincha-tea) */
function initFirebaseApp() {
  if (!fbReady) return null;
  const apps = getApps();
  if (apps.length > 0) return apps[0];
  return initializeApp(firebaseConfig);
}

export const fbApp = initFirebaseApp();
export const auth = fbApp ? getAuth(fbApp) : null;
export const storage = fbApp ? getStorage(fbApp) : null;

/** ID token สำหรับเรียก Cloud Functions (ส่งสรุป LINE) */
export async function getFirebaseIdToken(forceRefresh = false) {
  if (!auth?.currentUser) {
    throw new Error('กรุณาเข้าสู่ระบบใหม่');
  }
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('default Firebase app')) {
      throw new Error('เซสชันหมดอายุ — ออกจากระบบแล้วเข้าใหม่');
    }
    throw e;
  }
}

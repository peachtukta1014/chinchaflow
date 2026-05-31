import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { viteEnv } from './lib/viteEnv.js';

const LEGACY_APP_NAME = 'chincha-tea';

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

/** ใช้ [DEFAULT] app เท่านั้น — แอปเก่าชื่อ chincha-tea ทำให้ getIdToken() พัง */
function initFirebaseApp() {
  if (!fbReady) return null;
  const apps = getApps();
  const defaultApp = apps.find((a) => a.name === '[DEFAULT]');
  if (defaultApp) return defaultApp;

  if (apps.some((a) => a.name === LEGACY_APP_NAME)) {
    try {
      return initializeApp(firebaseConfig);
    } catch (e) {
      if (e?.code === 'app/duplicate-app') {
        try {
          return getApp();
        } catch {
          /* fall through */
        }
      }
      throw e;
    }
  }

  if (apps.length > 0) return apps[0];
  return initializeApp(firebaseConfig);
}

export function getAuthInstance() {
  const app = initFirebaseApp();
  return app ? getAuth(app) : null;
}

export const fbApp = initFirebaseApp();
export const auth = getAuthInstance();
export const storage = fbApp ? getStorage(fbApp) : null;

export function isFirebaseAppInitError(message = '', code = '') {
  const m = String(message).toLowerCase();
  const c = String(code).toLowerCase();
  return (
    c === 'app/no-app'
    || m.includes('default firebase app')
    || m.includes("no firebase app '[default]'")
    || m.includes('call initializeapp()')
  );
}

/** ID token สำหรับเรียก Cloud Functions (ส่งสรุป LINE) และ Firestore REST */
export async function getFirebaseIdToken(forceRefresh = false) {
  if (!fbReady) {
    throw new Error('Firebase ยังไม่พร้อม — กดปุ่มรีเฟรชที่มุมขวาบนแล้วลองใหม่');
  }
  const authInst = getAuthInstance();
  if (!authInst?.currentUser) {
    throw new Error('กรุณาเข้าสู่ระบบใหม่');
  }
  try {
    return await authInst.currentUser.getIdToken(forceRefresh);
  } catch (e) {
    const msg = e?.message || '';
    if (isFirebaseAppInitError(msg, e?.code)) {
      try {
        await signOut(authInst);
      } catch {
        /* ignore */
      }
      throw new Error('เวอร์ชันแอปเก่า — กดปุ่มรีเฟรช (ลูกศรกลม) ที่หัวแอป แล้วเข้าสู่ระบบใหม่');
    }
    throw e;
  }
}

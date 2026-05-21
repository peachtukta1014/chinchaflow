import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
export const fbReady = required.every((k) => Boolean(firebaseConfig[k]));

export const fbApp = fbReady ? initializeApp(firebaseConfig, 'chincha-tea') : null;
export const auth = fbApp ? getAuth(fbApp) : null;
export const db = fbApp ? getFirestore(fbApp, 'chincha') : null;
export const storage = fbApp ? getStorage(fbApp) : null;

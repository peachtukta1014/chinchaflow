import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { viteEnv } from './lib/viteEnv.js';

const firebaseConfig = {
  apiKey:            viteEnv('VITE_FIREBASE_API_KEY'),
  authDomain:        viteEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL:       viteEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId:         viteEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     viteEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: viteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             viteEnv('VITE_FIREBASE_APP_ID'),
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
const missingKeys  = requiredKeys.filter(k => !firebaseConfig[k]);

export const isFirebaseReady    = missingKeys.length === 0;
export const firebaseMissingKeys = missingKeys;

export const app     = isFirebaseReady ? initializeApp(firebaseConfig) : null;
export const db      = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app)   : null;
export const auth    = app ? getAuth(app)       : null;

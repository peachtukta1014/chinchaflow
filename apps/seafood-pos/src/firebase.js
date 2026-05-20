import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const env = import.meta.env;

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       env.VITE_FIREBASE_DATABASE_URL,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
const missingKeys  = requiredKeys.filter(k => !firebaseConfig[k]);

export const isFirebaseReady    = missingKeys.length === 0;
export const firebaseMissingKeys = missingKeys;

export const app     = isFirebaseReady ? initializeApp(firebaseConfig) : null;
export const db      = app ? getFirestore(app, 'chincha') : null;
export const storage = app ? getStorage(app)   : null;
export const auth    = app ? getAuth(app)       : null;

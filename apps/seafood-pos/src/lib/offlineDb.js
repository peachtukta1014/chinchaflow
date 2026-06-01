/** IndexedDB store for offline POS bill queue (survives page reload). */

const DB_NAME = 'seafood-pos-offline';
const STORE = 'pendingSales';
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB ไม่รองรับในเบราว์เซอร์นี้'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error || new Error('เปิด IndexedDB ไม่ได้'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

function withStore(mode, fn) {
  return openDb().then(
    (db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = fn(store);
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    }),
  );
}

export async function idbPut(record) {
  return withStore('readwrite', (store) => {
    store.put(record);
  });
}

export async function idbGet(id) {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

export async function idbGetAll() {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function idbDelete(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

import { auth } from '../firebase';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const FS_BASE = projectId
  ? `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  : null;

async function authHeaders() {
  const base = { 'Content-Type': 'application/json' };
  const user = auth?.currentUser;
  if (!user) return base;
  try {
    const token = await user.getIdToken();
    return { ...base, Authorization: `Bearer ${token}` };
  } catch {
    return base;
  }
}

export function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: fsObj(v) } };
  return { nullValue: null };
}

export function fsObj(o) {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fsVal(v)]),
  );
}

export function fromFsVal(v) {
  if (!v || 'nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ('mapValue' in v) return fromFsFields(v.mapValue.fields || {});
  return null;
}

export function fromFsFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFsVal(v)]));
}

function docFromRow(row) {
  const parts = row.document.name.split('/');
  return { id: parts[parts.length - 1], ...fromFsFields(row.document.fields || {}) };
}

export async function fsGetDoc(path) {
  const r = await fetch(`${FS_BASE}/${path}`, { headers: await authHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path} HTTP ${r.status}`);
  const json = await r.json();
  const parts = json.name.split('/');
  return { id: parts[parts.length - 1], ...fromFsFields(json.fields || {}) };
}

export async function fsPost(col, data) {
  const r = await fetch(`${FS_BASE}/${col}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ fields: fsObj(data) }),
  });
  if (!r.ok) throw new Error(`POST /${col} HTTP ${r.status}`);
  const json = await r.json();
  const parts = json.name.split('/');
  return { id: parts[parts.length - 1], ...fromFsFields(json.fields || {}) };
}

export async function fsPatch(path, data) {
  const fields = fsObj(data);
  const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const r = await fetch(`${FS_BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`PATCH ${path} HTTP ${r.status}`);
}

export async function fsDelete(path) {
  const r = await fetch(`${FS_BASE}/${path}`, { method: 'DELETE', headers: await authHeaders() });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${path} HTTP ${r.status}`);
}

export async function fsRunQuery(structuredQuery) {
  const r = await fetch(`${FS_BASE}:runQuery`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.filter((row) => row.document).map(docFromRow);
}

export async function fsListCollection(col, pageSize = 200) {
  const r = await fetch(`${FS_BASE}/${col}?pageSize=${pageSize}`, { headers: await authHeaders() });
  if (!r.ok) return [];
  const json = await r.json();
  return (json.documents || []).map((doc) => {
    const parts = doc.name.split('/');
    return { id: parts[parts.length - 1], ...fromFsFields(doc.fields || {}) };
  });
}

function sortByCreatedAtDesc(docs) {
  return docs.sort((a, b) => {
    const ta = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt || '');
    const tb = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt || '');
    return tb.localeCompare(ta);
  });
}

function orderMatchesDateKey(doc, dateKey) {
  if (doc.dateKey === dateKey) return true;
  const created = typeof doc.createdAt === 'string' ? doc.createdAt : '';
  return created.startsWith(dateKey);
}

export async function fsQueryOrders(dateKey) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'teaOrders' }],
    where: { fieldFilter: { field: { fieldPath: 'dateKey' }, op: 'EQUAL', value: { stringValue: dateKey } } },
    limit: 200,
  });
  if (docs.length > 0) return sortByCreatedAtDesc(docs);
  // ออเดอร์เก่าที่ไม่มี dateKey — ดึงรายการแล้วกรองจาก createdAt
  const all = await fsListCollection('teaOrders', 200);
  return sortByCreatedAtDesc(all.filter((d) => orderMatchesDateKey(d, dateKey)));
}

export async function fsQueryRestocks(limit = 50) {
  const docs = await fsListCollection('restocks', 100);
  return sortByCreatedAtDesc(docs).slice(0, limit);
}

export async function fsQueryRestocksByDate(dateKey) {
  const docs = await fsListCollection('restocks', 200);
  return sortByCreatedAtDesc(docs.filter((d) => d.dateKey === dateKey));
}

export async function fsQueryExpenses(dateKey) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'dailyExpenses' }],
    where: { fieldFilter: { field: { fieldPath: 'dateKey' }, op: 'EQUAL', value: { stringValue: dateKey } } },
    limit: 100,
  });
  return docs.sort((a, b) => {
    const ta = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt || '');
    const tb = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt || '');
    return ta.localeCompare(tb);
  });
}

export async function fsQueryUsers() {
  return fsListCollection('users');
}

export async function fsQueryProducts() {
  return fsListCollection('products');
}

export async function fsQueryToppings() {
  return fsListCollection('toppings');
}

export async function fsGetConfig(docId = 'teaLine') {
  return fsGetDoc(`config/${docId}`);
}

export async function fsSetConfig(docId, data) {
  const existing = await fsGetDoc(`config/${docId}`);
  if (existing) await fsPatch(`config/${docId}`, data);
  else {
    const r = await fetch(`${FS_BASE}/config?documentId=${encodeURIComponent(docId)}`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ fields: fsObj(data) }),
    });
    if (!r.ok) throw new Error(`POST config/${docId} HTTP ${r.status}`);
  }
}

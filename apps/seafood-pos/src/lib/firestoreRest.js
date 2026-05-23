/**
 * Firestore REST — ใช้ Bearer token จาก Firebase Auth (pattern เดียวกับ chincha-tea)
 */
import { auth } from '../firebase';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const FS_BASE = projectId
  ? `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  : null;

export async function fsAuthHeaders() {
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
  if ('mapValue' in v) {
    return Object.fromEntries(
      Object.entries(v.mapValue.fields || {}).map(([k, w]) => [k, fromFsVal(w)]),
    );
  }
  return null;
}

function docFromRow(row) {
  const parts = row.document.name.split('/');
  return {
    id: parts[parts.length - 1],
    ...Object.fromEntries(
      Object.entries(row.document.fields || {}).map(([k, v]) => [k, fromFsVal(v)]),
    ),
  };
}

export function fromFsFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromFsVal(v)]));
}

export async function fsGetDoc(path) {
  const r = await fetch(`${FS_BASE}/${path}`, { headers: await fsAuthHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path} HTTP ${r.status}`);
  const json = await r.json();
  const parts = json.name.split('/');
  return { id: parts[parts.length - 1], ...fromFsFields(json.fields) };
}

export async function fsPost(col, data) {
  const r = await fetch(`${FS_BASE}/${col}`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields: fsObj(data) }),
  });
  if (!r.ok) throw new Error(`Firestore /${col} POST failed (HTTP ${r.status})`);
}

export async function fsPatch(path, data) {
  const fields = fsObj(data);
  const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const r = await fetch(`${FS_BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore /${path} PATCH failed (HTTP ${r.status})`);
}

export async function fsSetStockDoc(data) {
  try {
    await fsPatch('config/stock', data);
  } catch {
    const r = await fetch(`${FS_BASE}/config?documentId=stock`, {
      method: 'POST',
      headers: await fsAuthHeaders(),
      body: JSON.stringify({ fields: fsObj(data) }),
    });
    if (!r.ok) throw new Error(`Firestore config/stock POST failed (HTTP ${r.status})`);
  }
}

export async function fsRunQuery(structuredQuery) {
  const r = await fetch(`${FS_BASE}:runQuery`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.filter((row) => row.document).map(docFromRow);
}

export async function fsListCollection(col, pageSize = 200) {
  const r = await fetch(`${FS_BASE}/${col}?pageSize=${pageSize}`, { headers: await fsAuthHeaders() });
  if (!r.ok) return [];
  const json = await r.json();
  return (json.documents || []).map((doc) => {
    const parts = doc.name.split('/');
    return { id: parts[parts.length - 1], ...fromFsFields(doc.fields || {}) };
  });
}

function sortSalesDesc(docs) {
  return docs.sort((a, b) => {
    const ta = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt || '');
    const tb = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt || '');
    return tb.localeCompare(ta);
  });
}

function saleMatchesDateKey(doc, dateKey) {
  if (doc.dateKey === dateKey) return true;
  const created = typeof doc.createdAt === 'string' ? doc.createdAt : '';
  return created.startsWith(dateKey);
}

/** โหลดบิลขายตามวัน — REST (เดียวกับตอนบันทึก fsPost) */
export async function fsQuerySales(dateKey) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'dateKey' },
        op: 'EQUAL',
        value: { stringValue: dateKey },
      },
    },
    limit: 200,
  });
  if (docs.length > 0) return sortSalesDesc(docs);
  const all = await fsListCollection('sales', 200);
  return sortSalesDesc(all.filter((d) => saleMatchesDateKey(d, dateKey)));
}

export async function fsIncrementDebt(customerId, meta, delta) {
  let current = 0;
  try {
    const r = await fetch(`${FS_BASE}/customerDebts/${customerId}`, { headers: await fsAuthHeaders() });
    if (r.ok) {
      const j = await r.json();
      const fv = j.fields?.totalDebt;
      current = parseFloat(fv?.doubleValue ?? fv?.integerValue ?? 0);
    }
  } catch {
    /* best-effort read */
  }
  return fsPatch(`customerDebts/${customerId}`, { ...meta, totalDebt: current + delta });
}

/**
 * Firestore REST — ใช้ Bearer token จาก Firebase Auth (pattern เดียวกับ chincha-tea)
 */
import { auth } from '../firebase';
import { dateKeysBetween, saleDateKeyFromBill } from './date.js';
import { sortSalesFifoAsc } from './saleFifo.js';

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
  const json = await r.json().catch(() => null);
  if (!json?.name) return null;
  const parts = json.name.split('/');
  return parts[parts.length - 1];
}

/** สร้างโปรไฟล์ shrimp_users/{uid} */
export async function fsSetShrimpUser(uid, data) {
  const fields = fsObj(data);
  let r = await fetch(`${FS_BASE}/shrimp_users/${uid}`, {
    method: 'PATCH',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (r.ok) return;
  const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  r = await fetch(`${FS_BASE}/shrimp_users/${uid}?${qs}`, {
    method: 'PATCH',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (r.ok) return;
  r = await fetch(`${FS_BASE}/shrimp_users?documentId=${encodeURIComponent(uid)}`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`shrimp_users/${uid} HTTP ${r.status}`);
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

/** สร้างหรืออัปเดตเอกสารตาม path (PATCH+updateMask หรือ POST ถ้ายังไม่มี) */
export async function fsSetDoc(path, data) {
  if (!FS_BASE) throw new Error('Firestore ไม่ได้ตั้งค่า');
  const fields = fsObj(data);
  if (!Object.keys(fields).length) throw new Error('ไม่มีข้อมูลให้บันทึก');

  const parts = path.split('/');
  const col = parts.slice(0, -1).join('/');
  const docId = parts[parts.length - 1];
  const headers = await fsAuthHeaders();
  if (!headers.Authorization) {
    throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
  }

  const qs = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');

  let r = await fetch(`${FS_BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });

  if (r.status === 404) {
    r = await fetch(`${FS_BASE}/${col}?documentId=${encodeURIComponent(docId)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields }),
    });
  }

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`บันทึกไม่สำเร็จ (HTTP ${r.status})${errText ? `: ${errText.slice(0, 120)}` : ''}`);
  }
}

export async function fsDelete(path) {
  const r = await fetch(`${FS_BASE}/${path}`, {
    method: 'DELETE',
    headers: await fsAuthHeaders(),
  });
  if (r.status === 404) return;
  if (!r.ok) throw new Error(`Firestore DELETE ${path} HTTP ${r.status}`);
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
  if (!r.ok) {
    console.warn('fsRunQuery failed', r.status, await r.text().catch(() => ''));
    return [];
  }
  const rows = await r.json();
  return rows.filter((row) => row.document).map(docFromRow);
}

/** โหลดออเดอร์ LINE — มี fallback ถ้า index ยังไม่พร้อม */
export async function fsQueryLineOrders({ pendingOnly = false, minDeliveryDate } = {}) {
  if (pendingOnly && minDeliveryDate) {
    const filtered = await fsRunQuery({
      from: [{ collectionId: 'lineOrders' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'deliveryDate' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { stringValue: minDeliveryDate },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'pending' },
              },
            },
          ],
        },
      },
      limit: 100,
    });
    if (filtered.length > 0) return filtered;
  }

  const all = await fsListCollection('lineOrders', 200);
  return all
    .filter((o) => {
      if (minDeliveryDate && (o.deliveryDate || '') < minDeliveryDate) return false;
      if (pendingOnly && o.status !== 'pending') return false;
      return true;
    })
    .sort((a, b) => {
      const ta = a.createdAt?.timestampValue || a.createdAt || '';
      const tb = b.createdAt?.timestampValue || b.createdAt || '';
      return String(tb).localeCompare(String(ta));
    });
}

function sortStockBatchesDesc(docs) {
  return [...docs].sort((a, b) => {
    const ta = String(a.purchaseDate || a.createdAt || '');
    const tb = String(b.purchaseDate || b.createdAt || '');
    return tb.localeCompare(ta);
  });
}

/** โหลดล็อต FIFO — query แล้ว fallback list ทั้ง collection */
/** ประวัติย้ายบ่อ / เสียหาย ตามวัน */
export async function fsQueryStockAdjustments(dateKey, limit = 80) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'stockAdjustments' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'dateKey' },
        op: 'EQUAL',
        value: { stringValue: dateKey },
      },
    },
    limit,
  });
  if (docs.length > 0) {
    return docs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  const recent = await fsListCollection('stockAdjustments', 40);
  return recent
    .filter((d) => d.dateKey === dateKey)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function fsQueryStockBatches(limit = 30) {
  const rows = await fsRunQuery({
    from: [{ collectionId: 'stockBatches' }],
    orderBy: [{ field: { fieldPath: 'purchaseDate' }, direction: 'DESCENDING' }],
    limit,
  });
  if (rows.length > 0) return sortStockBatchesDesc(rows).slice(0, limit);

  const all = await fsListCollection('stockBatches', 200);
  return sortStockBatchesDesc(all).slice(0, limit);
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
  return saleDateKeyFromBill(doc) === dateKey;
}

function mergeUniqueSales(docs) {
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    const id = d.id || d.billNo;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

/** โหลดบิลขายตามวัน — ไม่ดึงทั้ง collection */
export async function fsQuerySales(dateKey) {
  const queried = await fsRunQuery({
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

  const recent = await fsListCollection('sales', 400);
  const matched = recent.filter((d) => saleMatchesDateKey(d, dateKey));
  return sortSalesDesc(mergeUniqueSales([...queried, ...matched]));
}

/** บิลขายช่วงวัน (สรุปล็อต) — query รายวัน + fallback รวมบิลจาก list */
export async function fsQuerySalesBetween(startKey, endKey) {
  if (!startKey || !endKey || startKey > endKey) return [];

  const keys = dateKeysBetween(startKey, endKey, 120);
  let merged = [];
  for (const dk of keys) {
    const docs = await fsQuerySales(dk);
    merged = mergeUniqueSales([...merged, ...docs]);
  }
  if (merged.length > 0) return sortSalesDesc(merged);

  const all = await fsListCollection('sales', 500);
  return sortSalesDesc(
    all.filter((d) => {
      const dk = saleDateKeyFromBill(d);
      return dk && dk >= startKey && dk <= endKey;
    }),
  );
}

/** ประวัติปรับสต๊อก (ย้ายบ่อ / เสียหาย / ชั่งปิด) */
export async function fsListStockAdjustments(limit = 200) {
  const rows = await fsListCollection('stockAdjustments', limit);
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** บิลมียอดค้าง — ใช้แท็บลูกหนี้/FIFO (มักมีไม่กี่สิบบิล ไม่ใช่ทั้งระบบ) */
export async function fsQueryOpenSales(limit = 120) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'remainingAmount' },
        op: 'GREATER_THAN',
        value: { doubleValue: 0 },
      },
    },
    limit,
  });
  if (docs.length > 0) return sortSalesFifoAsc(docs);

  const recent = await fsListCollection('sales', 80);
  return sortSalesFifoAsc(
    recent.filter((d) => (parseFloat(d.remainingAmount) || 0) > 0),
  );
}

/** บิลขายของลูกค้าคนเดียว — ใช้ตอนรับชำระผ่อน/FIFO */
export async function fsQuerySalesByCustomer(customerId, limit = 80) {
  if (!customerId) return [];
  const docs = await fsRunQuery({
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'customerId' },
        op: 'EQUAL',
        value: { stringValue: customerId },
      },
    },
    limit,
  });
  if (docs.length > 0) return sortSalesDesc(docs);
  const open = await fsQueryOpenSales(limit);
  return sortSalesDesc(open.filter((d) => d.customerId === customerId));
}

export async function fsIncrementDebt(customerId, meta, delta) {
  if (!FS_BASE || !customerId) return;
  const deltaN = parseFloat(delta) || 0;
  if (deltaN === 0) return;

  const path = `customerDebts/${customerId}`;
  const headers = await fsAuthHeaders();
  let current = 0;
  const r = await fetch(`${FS_BASE}/${path}`, { headers });
  if (r.ok) {
    const j = await r.json();
    const fv = j.fields?.totalDebt;
    current = parseFloat(fv?.doubleValue ?? fv?.integerValue ?? 0);
  } else if (r.status !== 404) {
    throw new Error(`GET ${path} HTTP ${r.status}`);
  }

  const totalDebt = current + deltaN;
  const fields = fsObj({
    customerId,
    customerName: meta.customerName || '',
    zone: meta.zone || 'ทั่วไป',
    lastBillNo: meta.lastBillNo || '',
    lastUpdated: meta.lastUpdated || new Date().toISOString(),
    totalDebt,
  });

  if (r.ok) {
    return fsPatch(path, {
      customerName: meta.customerName,
      zone: meta.zone,
      lastBillNo: meta.lastBillNo,
      lastUpdated: meta.lastUpdated,
      totalDebt,
    });
  }

  const create = await fetch(
    `${FS_BASE}/customerDebts?documentId=${encodeURIComponent(customerId)}`,
    { method: 'POST', headers, body: JSON.stringify({ fields }) },
  );
  if (!create.ok) throw new Error(`สร้างลูกหนี้ไม่สำเร็จ HTTP ${create.status}`);
}

/**
 * Firestore REST — ใช้ Bearer token จาก Firebase Auth (pattern เดียวกับ chincha-tea)
 */
import { auth } from '../firebase';
import { dateKeysBetween, saleDateKeyFromBill } from './date.js';
import { sortSalesFifoAsc } from './saleFifo.js';
import { FIREBASE_PROJECT_ID } from './viteEnv.js';

const projectId = FIREBASE_PROJECT_ID;
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

/** ฟิลด์น้ำหนักกก. ใน stockBatches — ใช้ doubleValue เสมอ (หลีกเลี่ยง commit 400 จาก integer/double mismatch) */
const STOCK_KG_FIELD_NAMES = ['liveKg', 'deadKg', 'remainingLiveKg', 'remainingDeadKg'];

/** @param {'integer'|'double'} kind — ต้องตรงกับที่เก็บใน Firestore (ล็อตเก่ามักเป็น integer) */
export function fsStockKgVal(kg, kind = 'double') {
  const n = parseFloat(Number(kg).toFixed(3));
  if (!Number.isFinite(n)) {
    throw new Error(`ค่าน้ำหนักไม่ถูกต้อง: ${kg}`);
  }
  if (kind === 'integer') {
    return { integerValue: String(Math.round(n)) };
  }
  return { doubleValue: n };
}

export function fsKgTypesFromFields(fields) {
  const types = {};
  for (const key of STOCK_KG_FIELD_NAMES) {
    const raw = fields?.[key];
    if (!raw) continue;
    if ('integerValue' in raw) types[key] = 'integer';
    else if ('doubleValue' in raw) types[key] = 'double';
  }
  return types;
}

export function stockKgFirestoreValue(kg, fieldKey, kgTypes = {}) {
  return fsStockKgVal(kg, kgTypes[fieldKey] || 'double');
}

export function fsObjStockFields(data) {
  const fields = fsObj(data);
  const kgTypes = data._fsKgTypes || data._kgTypes || {};
  for (const key of STOCK_KG_FIELD_NAMES) {
    if (data[key] !== undefined && data[key] !== null) {
      fields[key] = stockKgFirestoreValue(data[key], key, kgTypes);
    }
  }
  return fields;
}

function docFieldsToModel(fields, id) {
  return {
    id,
    ...fromFsFields(fields),
    _fsKgTypes: fsKgTypesFromFields(fields),
  };
}

/** ข้อความ error สำหรับผู้ใช้เมื่อบันทึก/ตัดสต๊อกล้ม */
export function formatFirestoreSaveError(err) {
  const msg = String(err?.message || err || '');
  if (/Invalid project ID/i.test(msg)) {
    return 'ตั้งค่า Firebase ผิด (project ID มีช่องว่าง/ขึ้นบรรทัดใหม่) — แจ้งแอดมินให้ deploy ใหม่';
  }
  if (/fsAtomicStockBatchCommit HTTP 400/i.test(msg)) {
    return 'ตัดสต๊อกไม่สำเร็จ — รีเฟรชหน้าแล้วลองอีกครั้ง (อย่ากดซ้ำถ้าไม่แน่ใจว่าสำเร็จ)';
  }
  if (/403|PERMISSION_DENIED/i.test(msg)) {
    return 'บันทึกไม่สำเร็จ (สิทธิ์ระบบ) — แจ้งแอดมินให้อัปเดต Firestore rules';
  }
  if (/timeout|Failed to fetch|NetworkError/i.test(msg)) {
    return 'เชื่อมต่อไม่สำเร็จ — รอเน็ตกลับแล้วลองอีกครั้ง';
  }
  if (/สต๊อกในล็อตไม่พอ|ขายเกินสต๊อก/i.test(msg)) return msg;
  return 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ';
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
  return docFieldsToModel(row.document.fields || {}, parts[parts.length - 1]);
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
  return docFieldsToModel(json.fields || {}, parts[parts.length - 1]);
}

export async function fsPost(col, data) {
  const fields = col === 'stockBatches' ? fsObjStockFields(data) : fsObj(data);
  const r = await fetch(`${FS_BASE}/${col}`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
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
  const fields = path.startsWith('stockBatches/') ? fsObjStockFields(data) : fsObj(data);
  const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const r = await fetch(`${FS_BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore /${path} PATCH failed (HTTP ${r.status})`);
}

/** สร้างเอกสารใหม่ใน collection (Firestore auto-ID) */
export async function fsAddDoc(collection, data) {
  if (!FS_BASE) throw new Error('Firestore ไม่ได้ตั้งค่า');
  const fields = fsObj(data);
  const r = await fetch(`${FS_BASE}/${collection}`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore ${collection} POST failed (HTTP ${r.status})`);
  const json = await r.json();
  const name = json.name || '';
  const id = name.split('/').pop();
  return { id, ...data };
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

const LINE_ORDERS_PAGE_SIZE = 100;
const LINE_ORDERS_MAX_PAGES = 8;

function lineOrdersByStatusStructuredQuery(status, { limit = LINE_ORDERS_PAGE_SIZE, startAfterCreatedAt } = {}) {
  const structuredQuery = {
    from: [{ collectionId: 'lineOrders' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'EQUAL',
        value: { stringValue: status },
      },
    },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit,
  };
  if (startAfterCreatedAt) {
    structuredQuery.startAt = {
      values: [{ timestampValue: startAfterCreatedAt }],
      before: false,
    };
  }
  return structuredQuery;
}

async function fsQueryLineOrdersByStatus(status) {
  const merged = [];
  const seen = new Set();
  let cursor = null;

  for (let page = 0; page < LINE_ORDERS_MAX_PAGES; page += 1) {
    const batch = await fsRunQuery(lineOrdersByStatusStructuredQuery(status, {
      startAfterCreatedAt: cursor,
    }));
    if (batch.length === 0) break;

    let added = 0;
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      added += 1;
    }

    if (batch.length < LINE_ORDERS_PAGE_SIZE || added === 0) break;
    const last = batch[batch.length - 1];
    const nextCursor = last.createdAt || null;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  return merged;
}

/** โหลดออเดอร์รอส่ง + กำลังบันทึก (แบ่งหน้า) */
export async function fsQueryAllPendingLineOrders() {
  const pending = await fsQueryLineOrdersByStatus('pending');
  const delivering = await fsQueryLineOrdersByStatus('delivering');
  const seen = new Set();
  const merged = [];
  for (const row of [...pending, ...delivering]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  if (merged.length > 0) return merged;

  const all = await fsListCollection('lineOrders', 500);
  return all.filter((o) => o.status === 'pending' || o.status === 'delivering');
}

/** บิลจากออเดอร์ LINE — ใช้กันสร้างซ้ำเมื่อ patch ออเดอร์ล้มเหลว */
export async function fsQuerySaleByLineOrderId(lineOrderId) {
  if (!lineOrderId) return null;
  const docs = await fsRunQuery({
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'lineOrderId' },
        op: 'EQUAL',
        value: { stringValue: String(lineOrderId) },
      },
    },
    limit: 1,
  });
  return docs[0] || null;
}

/** @deprecated ใช้ fsQueryAllPendingLineOrders สำหรับบอร์ด */
export async function fsQueryLineOrders({ pendingOnly = false, minDeliveryDate } = {}) {
  if (pendingOnly) {
    return fsQueryAllPendingLineOrders();
  }

  const all = await fsListCollection('lineOrders', 200);
  return all
    .filter((o) => {
      if (minDeliveryDate && (o.deliveryDate || '') < minDeliveryDate) return false;
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

/** โหลดล็อตรับเข้าทั้งหมด (ต้องครบเพื่อ FIFO — ห้ามตัดเหลือแค่ล็อตใหม่สุด) */
export async function fsQueryStockBatches() {
  const all = await fsListCollection('stockBatches', 200);
  if (all.length > 0) return sortStockBatchesDesc(all);

  const rows = await fsRunQuery({
    from: [{ collectionId: 'stockBatches' }],
    orderBy: [{ field: { fieldPath: 'purchaseDate' }, direction: 'DESCENDING' }],
    limit: 500,
  });
  return sortStockBatchesDesc(rows);
}

/** ข้อความจาก LINE webhook — ใช้ดึง Group / User ID ล่าสุด */
export async function fsQueryLineMessages(limit = 80) {
  const docs = await fsListCollection('line_messages', Math.min(limit * 2, 200));
  return docs
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

export async function fsListCollection(col, pageSize = 200) {
  const allDocs = [];
  let pageToken = null;
  let pages = 0;
  const MAX_PAGES = 10;
  do {
    const qs = pageToken
      ? `?pageSize=${pageSize}&pageToken=${encodeURIComponent(pageToken)}`
      : `?pageSize=${pageSize}`;
    const r = await fetch(`${FS_BASE}/${col}${qs}`, { headers: await fsAuthHeaders() });
    if (!r.ok) break;
    const json = await r.json();
    const docs = (json.documents || []).map((doc) => {
      const parts = doc.name.split('/');
      return docFieldsToModel(doc.fields || {}, parts[parts.length - 1]);
    });
    allDocs.push(...docs);
    pageToken = json.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < MAX_PAGES);
  return allDocs;
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

/** บิลเก่าที่ยังไม่มีฟิลด์ dateKey — ดึงจาก list เล็กเท่านั้น */
const SALES_LEGACY_FALLBACK_SIZE = 80;

/** โหลดบิลขายตามวัน — query ตาม dateKey ก่อน; list ทั้ง collection เฉพาะ fallback เล็ก */
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

  if (queried.length > 0) {
    const recent = await fsListCollection('sales', SALES_LEGACY_FALLBACK_SIZE);
    const legacy = recent.filter(
      (d) => !d.dateKey && saleMatchesDateKey(d, dateKey),
    );
    return sortSalesDesc(mergeUniqueSales([...queried, ...legacy]));
  }

  const recent = await fsListCollection('sales', SALES_LEGACY_FALLBACK_SIZE);
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

const OPEN_SALES_PAGE_SIZE = 100;
const OPEN_SALES_MAX_PAGES = 6;

function openSalesStructuredQuery({ limit = OPEN_SALES_PAGE_SIZE, startAfterCreatedAt } = {}) {
  const structuredQuery = {
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'remainingAmount' },
        op: 'GREATER_THAN',
        value: { doubleValue: 0 },
      },
    },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
    limit,
  };
  if (startAfterCreatedAt) {
    structuredQuery.startAt = {
      values: [{ timestampValue: startAfterCreatedAt }],
      before: false,
    };
  }
  return structuredQuery;
}

/** บิลมียอดค้าง — แบ่งหน้า (กัน cap 120 ตัดลูกค้าท้ายๆ ออกจาก index AR) */
export async function fsQueryOpenSales(limit = 600) {
  const maxPages = Math.max(1, Math.ceil(limit / OPEN_SALES_PAGE_SIZE));
  const merged = [];
  const seen = new Set();
  let cursor = null;

  for (let page = 0; page < Math.min(maxPages, OPEN_SALES_MAX_PAGES); page += 1) {
    const batch = await fsRunQuery(openSalesStructuredQuery({
      startAfterCreatedAt: cursor,
    }));
    if (batch.length === 0) break;

    let added = 0;
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      if ((parseFloat(row.remainingAmount) || 0) <= 0) continue;
      seen.add(row.id);
      merged.push(row);
      added += 1;
    }

    if (batch.length < OPEN_SALES_PAGE_SIZE || added === 0) break;
    const last = batch[batch.length - 1];
    const nextCursor = last.createdAt || null;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  if (merged.length > 0) return sortSalesFifoAsc(merged);

  const recent = await fsListCollection('sales', 200);
  return sortSalesFifoAsc(
    recent.filter((d) => (parseFloat(d.remainingAmount) || 0) > 0),
  );
}

const CUSTOMER_SALES_PAGE_SIZE = 100;
const CUSTOMER_SALES_MAX_PAGES = 4;

/** บิลขายของลูกค้าคนเดียว — query ตาม customerId แบ่งหน้า (ไม่พึ่ง open sales ทั้งระบบ) */
export async function fsQuerySalesByCustomer(customerId, limit = 400) {
  if (!customerId) return [];
  const maxPages = Math.max(1, Math.ceil(limit / CUSTOMER_SALES_PAGE_SIZE));
  const merged = [];
  const seen = new Set();
  let cursor = null;

  for (let page = 0; page < Math.min(maxPages, CUSTOMER_SALES_MAX_PAGES); page += 1) {
    const structuredQuery = {
      from: [{ collectionId: 'sales' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'customerId' },
          op: 'EQUAL',
          value: { stringValue: customerId },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: CUSTOMER_SALES_PAGE_SIZE,
    };
    if (cursor) {
      structuredQuery.startAt = {
        values: [{ timestampValue: cursor }],
        before: false,
      };
    }
    const batch = await fsRunQuery(structuredQuery);
    if (batch.length === 0) break;

    let added = 0;
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      added += 1;
    }

    if (batch.length < CUSTOMER_SALES_PAGE_SIZE || added === 0) break;
    const last = batch[batch.length - 1];
    const nextCursor = last.createdAt || null;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  if (merged.length > 0) return sortSalesDesc(merged);

  const recent = await fsListCollection('sales', 300);
  return sortSalesDesc(recent.filter((d) => d.customerId === customerId));
}

function debtIncrementCommitBody(customerId, meta, deltaN) {
  const docName = `projects/${projectId}/databases/(default)/documents/customerDebts/${customerId}`;
  return {
    writes: [{
      update: {
        name: docName,
        fields: fsObj({
          customerId,
          customerName: meta.customerName || '',
          zone: meta.zone || 'ทั่วไป',
          lastBillNo: meta.lastBillNo || '',
          lastUpdated: meta.lastUpdated || new Date().toISOString(),
        }),
      },
      updateMask: {
        fieldPaths: ['customerId', 'customerName', 'zone', 'lastBillNo', 'lastUpdated'],
      },
      updateTransforms: [{
        fieldPath: 'totalDebt',
        increment: { doubleValue: deltaN },
      }],
    }],
  };
}

function isFirestoreNotFoundError(status, errText = '') {
  return status === 404
    || /NOT_FOUND|No document to update/i.test(errText);
}

function isFirestoreAlreadyExistsError(status, errText = '') {
  return status === 409
    || /ALREADY_EXISTS/i.test(errText);
}

async function commitDebtIncrement(customerId, meta, deltaN) {
  const r = await fetch(`${FS_BASE}:commit`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify(debtIncrementCommitBody(customerId, meta, deltaN)),
  });
  const errText = r.ok ? '' : await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, errText };
}

async function createDebtDoc(customerId, meta, totalDebt) {
  const fields = fsObj({
    customerId,
    customerName: meta.customerName || '',
    zone: meta.zone || 'ทั่วไป',
    lastBillNo: meta.lastBillNo || '',
    lastUpdated: meta.lastUpdated || new Date().toISOString(),
    totalDebt,
  });
  const r = await fetch(
    `${FS_BASE}/customerDebts?documentId=${encodeURIComponent(customerId)}`,
    {
      method: 'POST',
      headers: await fsAuthHeaders(),
      body: JSON.stringify({ fields }),
    },
  );
  const errText = r.ok ? '' : await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, errText };
}

/**
 * อัปเดตยอดลูกหนี้แบบ atomic — ใช้ Firestore server-side increment ผ่าน :commit
 * ป้องกัน lost update เมื่อมีหลายรายการพร้อมกัน (ไม่ต้อง read-modify-write)
 * ถ้า customerDebts ยังไม่มี → สร้าง doc แล้ว retry increment (กันลูกค้าใหม่ขายเครดิตครั้งแรกล้ม)
 */
export async function fsIncrementDebt(customerId, meta, delta) {
  if (!FS_BASE || !customerId) return;
  const deltaN = parseFloat(delta) || 0;
  if (deltaN === 0) return;

  const first = await commitDebtIncrement(customerId, meta, deltaN);
  if (first.ok) return;

  if (isFirestoreNotFoundError(first.status, first.errText)) {
    const created = await createDebtDoc(customerId, meta, deltaN);
    if (created.ok) return;
    if (isFirestoreAlreadyExistsError(created.status, created.errText)) {
      const retry = await commitDebtIncrement(customerId, meta, deltaN);
      if (retry.ok) return;
      throw new Error(`fsIncrementDebt HTTP ${retry.status}`);
    }
    throw new Error(`fsIncrementDebt create HTTP ${created.status}`);
  }

  throw new Error(`fsIncrementDebt HTTP ${first.status}`);
}

export function fsDocName(collection, docId) {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
}

/** Firestore :commit หลาย write พร้อมกัน — สำเร็จหรือล้มทั้งชุด */
export async function fsCommitWrites(writes) {
  if (!FS_BASE || !writes?.length) return;
  const r = await fetch(`${FS_BASE}:commit`, {
    method: 'POST',
    headers: await fsAuthHeaders(),
    body: JSON.stringify({ writes }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(
      `fsCommitWrites HTTP ${r.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`,
    );
  }
}

/**
 * Atomic commit สำหรับ stockBatch หลายล็อตพร้อมกัน — ทั้งหมดสำเร็จหรือล้มพร้อมกัน
 * ป้องกันการตัดสต๊อกค้างกลางทาง (บางล็อตตัดแล้วแต่บางล็อตยังไม่ตัด)
 * patches: [{ id, remainingLiveKg, remainingDeadKg }, ...]
 */
export async function fsAtomicStockBatchCommit(patches) {
  if (!FS_BASE || !patches?.length) return;

  const byId = new Map();
  for (const p of patches) {
    if (!p?.id) {
      throw new Error('stockBatch ไม่มี id — รีเฟรชหน้าแล้วลองอีกครั้ง');
    }
    byId.set(p.id, p);
  }
  const unique = [...byId.values()];

  const writes = unique.map((p) => ({
    update: {
      name: fsDocName('stockBatches', p.id),
      fields: {
        remainingLiveKg: stockKgFirestoreValue(
          p.remainingLiveKg,
          'remainingLiveKg',
          p._kgTypes || p._fsKgTypes,
        ),
        remainingDeadKg: stockKgFirestoreValue(
          p.remainingDeadKg,
          'remainingDeadKg',
          p._kgTypes || p._fsKgTypes,
        ),
      },
    },
    updateMask: { fieldPaths: ['remainingLiveKg', 'remainingDeadKg'] },
  }));
  await fsCommitWrites(writes);
}

/** สลิปโอนจาก LINE ที่รอตรวจ */
export async function fsQueryPendingPaymentSlips(limit = 50) {
  const docs = await fsRunQuery({
    from: [{ collectionId: 'paymentSlipSubmissions' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'EQUAL',
        value: { stringValue: 'pending' },
      },
    },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit,
  });
  if (docs.length > 0) return docs;
  const all = await fsListCollection('paymentSlipSubmissions', 80);
  return all
    .filter((d) => d.status === 'pending')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function fsQuerySaleByBillNo(billNo) {
  const key = String(billNo || '').trim();
  if (!key) return null;
  const docs = await fsRunQuery({
    from: [{ collectionId: 'sales' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'billNo' },
        op: 'EQUAL',
        value: { stringValue: key },
      },
    },
    limit: 5,
  });
  return docs[0] || null;
}

import { fsDelete, fsListCollection, fsPatch, fsPost } from './firestoreRest';

export const RESTOCK_CATEGORIES = ['packaging', 'syrup', 'powder', 'liquid', 'sugar', 'other'];

const CATEGORY_RULES = [
  { id: 'packaging', re: /ฝา|แก้ว|ถุง|หลอด|ช้อน|กระดาษ|ถังขยะ|lid|cup|packaging/i },
  { id: 'syrup', re: /ไซรัป|syrup|เฮลบลูบอย|น้ำแดง|สตรอว์|มะม่วง|มะพร้าว|บลูเบอร์|คาราเมล|กลิ่น/i },
  { id: 'powder', re: /ผง|powder|มัทฉะ|โกโก้|กาแฟ/i },
  { id: 'liquid', re: /น้ำเชื่อม|นม|ครีม|น้ำแข็ง/i },
  { id: 'sugar', re: /น้ำตาล|นมข้นหวาน|หวาน/i },
];

/** คีย์เดียวกันสำหรับ dedup — ไม่สนตัวพิมพ์/ช่องว่าง */
export function restockNameKey(name) {
  return (name || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** จัดหมวดจากชื่อรายการ (อัตโนมัติ) */
export function guessRestockCategory(name) {
  const n = name || '';
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(n)) return rule.id;
  }
  return 'other';
}

export function restockCategoryLabel(category, t) {
  const key = `restockCat_${category}`;
  return t?.(key) || category;
}

export function compareRestockCatalogItems(a, b, locale = 'th') {
  const oa = typeof a.sortOrder === 'number' ? a.sortOrder : 1_000_000;
  const ob = typeof b.sortOrder === 'number' ? b.sortOrder : 1_000_000;
  if (oa !== ob) return oa - ob;
  return (a.name || '').localeCompare(b.name || '', locale, { sensitivity: 'base' });
}

/** เรียงหมวดตามลำดับที่กำหนด แล้ว sortOrder / ชื่อในแต่ละหมวด */
export function groupCatalogByCategory(catalog, t, lang = 'th') {
  const locale = lang === 'my' ? 'my' : 'th';
  const groups = new Map(RESTOCK_CATEGORIES.map((c) => [c, []]));

  for (const item of catalog || []) {
    if (item.active === false) continue;
    const cat = item.category || guessRestockCategory(item.name);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }

  return RESTOCK_CATEGORIES
    .filter((cat) => (groups.get(cat) || []).length > 0)
    .map((cat) => ({
      id: cat,
      label: restockCategoryLabel(cat, t),
      items: (groups.get(cat) || []).sort((a, b) => compareRestockCatalogItems(a, b, locale)),
    }));
}

/** สลับลำดับในแต่ละหมวด — คืน catalog ใหม่ + patch สำหรับ Firestore */
export function catalogReorderPatches(catalog, itemId, direction) {
  const item = (catalog || []).find((c) => c.id === itemId);
  if (!item) return { catalog: catalog || [], patches: [] };

  const cat = item.category || guessRestockCategory(item.name);
  const inCat = (catalog || [])
    .filter((c) => c.active !== false && (c.category || guessRestockCategory(c.name)) === cat)
    .sort((a, b) => compareRestockCatalogItems(a, b, 'th'));

  const idx = inCat.findIndex((c) => c.id === itemId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= inCat.length) {
    return { catalog: catalog || [], patches: [] };
  }

  const reordered = [...inCat];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  const patches = reordered.map((c, i) => ({ id: c.id, sortOrder: (i + 1) * 10 }));
  const orderById = new Map(patches.map((p) => [p.id, p.sortOrder]));
  const nextCatalog = (catalog || []).map((c) =>
    (orderById.has(c.id) ? { ...c, sortOrder: orderById.get(c.id) } : c),
  );
  return { catalog: nextCatalog, patches };
}

export async function patchRestockCatalogItem(id, patch) {
  await fsPatch(`restockCatalog/${id}`, patch);
}

export async function fsQueryRestockCatalog() {
  const docs = await fsListCollection('restockCatalog', 300);
  return docs
    .filter((d) => d.active !== false)
    .sort((a, b) => {
      const catA = a.category || guessRestockCategory(a.name);
      const catB = b.category || guessRestockCategory(b.name);
      const catCmp = RESTOCK_CATEGORIES.indexOf(catA) - RESTOCK_CATEGORIES.indexOf(catB);
      if (catCmp !== 0) return catCmp;
      return compareRestockCatalogItems(a, b, 'th');
    });
}

/** บันทึก/อัปเดตรายการในคatalog หลังส่งใบสั่งของ */
export async function upsertRestockCatalogItems(itemNames, member) {
  const existing = await fsListCollection('restockCatalog', 300);
  const byKey = new Map(existing.map((d) => [restockNameKey(d.name), d]));
  const now = new Date().toISOString();

  for (const rawName of itemNames) {
    const name = (rawName || '').trim();
    if (!name) continue;
    const key = restockNameKey(name);
    const prev = byKey.get(key);

    if (prev) {
      await fsPatch(`restockCatalog/${prev.id}`, {
        name,
        nameKey: key,
        category: prev.category || guessRestockCategory(name),
        usageCount: (prev.usageCount || 0) + 1,
        lastUsedAt: now,
        unit: prev.unit || 'ชิ้น',
        base_unit: prev.base_unit || prev.unit || 'ชิ้น',
        conversion_rate: Math.max(1, Math.round(Number(prev.conversion_rate) || 1)),
        active: true,
      });
    } else {
      const created = await fsPost('restockCatalog', {
        name,
        nameKey: key,
        category: guessRestockCategory(name),
        usageCount: 1,
        lastUsedAt: now,
        createdAt: now,
        createdBy: member?.name || '—',
        unit: 'ชิ้น',
        base_unit: 'ชิ้น',
        conversion_rate: 1,
        stock_base_qty: 0,
        active: true,
      });
      byKey.set(key, created);
    }
  }
}

/** ดึงรายการจากประวัติสั่งของมาเติม catalog ครั้งแรก */
export async function bootstrapCatalogFromRestocks(recentRestocks, member) {
  const names = new Set();
  for (const req of recentRestocks || []) {
    for (const it of req.items || []) {
      const n = (it.name || '').trim();
      if (n) names.add(n);
    }
  }
  if (names.size === 0) return 0;
  await upsertRestockCatalogItems([...names], member);
  return names.size;
}

export async function updateRestockCatalogPrices(purchaseItems = []) {
  const existing = await fsListCollection('restockCatalog', 300);
  const byKey = new Map(existing.map((d) => [restockNameKey(d.name), d]));
  const now = new Date().toISOString();

  for (const item of purchaseItems || []) {
    const name = (item?.name || '').trim();
    const unitPrice = Math.max(0, Math.round(Number(item?.unitPrice) || 0));
    if (!name || unitPrice <= 0) continue;
    const key = restockNameKey(name);
    const prev = byKey.get(key);
    const payload = {
      name,
      nameKey: key,
      category: prev?.category || guessRestockCategory(name),
      latestUnitPrice: unitPrice,
      latestLineTotal: Math.max(0, Math.round(Number(item?.lineTotal) || 0)),
      latestPurchaseQty: Math.max(1, Number(item?.qty) || 1),
      latestPriceAt: now,
      unit: item?.unit || prev?.unit || 'ชิ้น',
      base_unit: item?.base_unit || item?.baseUnit || prev?.base_unit || item?.unit || prev?.unit || 'ชิ้น',
      conversion_rate: Math.max(1, Math.round(Number(item?.conversion_rate ?? item?.conversionRate ?? prev?.conversion_rate) || 1)),
      stock_base_qty: Math.max(0, Math.round(Number(prev?.stock_base_qty) || 0)),
      active: true,
    };

    if (prev?.id) {
      await fsPatch(`restockCatalog/${prev.id}`, payload);
    } else {
      const created = await fsPost('restockCatalog', {
        ...payload,
        usageCount: 1,
        lastUsedAt: now,
        createdAt: now,
        createdBy: 'system',
      });
      byKey.set(key, created);
    }
  }
}

export async function deleteRestockCatalogItem(id) {
  await fsDelete(`restockCatalog/${id}`);
}

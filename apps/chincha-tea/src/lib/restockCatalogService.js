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

/** เรียงหมวดตามลำดับที่กำหนด แล้วเรียงชื่อในแต่ละหมวด */
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
      items: (groups.get(cat) || []).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', locale, { sensitivity: 'base' }),
      ),
    }));
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
      return (a.name || '').localeCompare(b.name || '', 'th', { sensitivity: 'base' });
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

export async function deleteRestockCatalogItem(id) {
  await fsDelete(`restockCatalog/${id}`);
}

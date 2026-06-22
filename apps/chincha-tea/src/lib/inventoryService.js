import { fsListCollection, fsPatch, fsPost, fsAtomicUpdate } from './firestoreRest';
import { guessRestockCategory, restockNameKey } from './restockCatalogService';
import {
  buildInventoryReceivePreview,
  cartBaseQtyToDeduct,
  deductBaseQty,
  nonNegativeInt,
  normalizeInventoryFields,
  positiveInt,
  receivedBaseQtyForLine,
} from './inventoryMath';

export {
  buildInventoryReceivePreview,
  cartBaseQtyToDeduct,
  deductBaseQty,
  normalizeInventoryFields,
  receivedBaseQtyForLine,
};

const CUP_NAME_RE = /แก้ว|cup/i;

function catalogKeyMap(catalog = []) {
  return new Map((catalog || []).map((item) => [restockNameKey(item.name), item]));
}

function lineInventoryPatch(line = {}, previous = {}) {
  const merged = normalizeInventoryFields({ ...previous, ...line });
  const receivedBaseQty = receivedBaseQtyForLine({ ...line, conversion_rate: merged.conversion_rate });
  const currentStock = nonNegativeInt(previous?.stock_base_qty, 0);
  return {
    ...merged,
    stock_base_qty: currentStock + receivedBaseQty,
    latestPurchaseQty: positiveInt(line.qty, 1),
    latestReceivedBaseQty: receivedBaseQty,
    latestInventoryAt: new Date().toISOString(),
    active: true,
  };
}

export async function receiveRestockInventory(purchaseItems = []) {
  const catalog = await fsListCollection('restockCatalog', 300);
  const byKey = catalogKeyMap(catalog);
  const updates = [];

  for (const line of purchaseItems || []) {
    const name = (line?.name || '').trim();
    if (!name) continue;
    const key = restockNameKey(name);
    const previous = byKey.get(key);
    const patch = {
      name,
      nameKey: key,
      category: previous?.category || guessRestockCategory(name),
      ...lineInventoryPatch(line, previous),
    };

    if (previous?.id) {
      const { stock_base_qty: _, ...fieldsWithoutStock } = patch;
      await fsAtomicUpdate(`restockCatalog/${previous.id}`, {
        fields: fieldsWithoutStock,
        increments: { stock_base_qty: patch.latestReceivedBaseQty },
      });
      updates.push({ id: previous.id, ...previous, ...patch });
    } else {
      const created = await fsPost('restockCatalog', {
        ...patch,
        usageCount: 1,
        lastUsedAt: patch.latestInventoryAt,
        createdAt: patch.latestInventoryAt,
        createdBy: 'system',
      });
      byKey.set(key, created);
      updates.push(created);
    }
  }

  return updates;
}

function findCupInventoryItem(catalog = []) {
  const active = (catalog || []).filter((item) => item.active !== false);
  return active.find((item) => restockNameKey(item.name) === restockNameKey('แก้ว'))
    || active.find((item) => restockNameKey(item.name) === restockNameKey('cup'))
    || active.find((item) => CUP_NAME_RE.test(item.name || ''));
}

export async function deductTeaOrderInventory(cart = []) {
  const baseQtyToDeduct = cartBaseQtyToDeduct(cart);
  if (baseQtyToDeduct <= 0) return null;

  const catalog = await fsListCollection('restockCatalog', 300);
  const item = findCupInventoryItem(catalog);
  if (!item?.id || item.stock_base_qty === undefined) return null;

  const currentStock = nonNegativeInt(item.stock_base_qty, 0);
  const normalized = normalizeInventoryFields(item);
  // ⚠️ atomic decrement ผ่าน Firestore increment (ค่าลบ) — กันสต๊อกตัดผิดเวลา
  // ขายพร้อมกันหลายคน แต่ Firestore increment ไม่รองรับ clamp ขั้นต่ำที่ 0
  // ในระดับ field transform เหมือน deductBaseQty เดิมที่ใช้ Math.max(0, ...)
  // ฝั่ง client ดังนั้นถ้าขายเกินสต๊อกจริงพร้อมกันหลายเครื่อง ค่าอาจติดลบ
  // ชั่วคราวใน Firestore ได้ — ให้ UI ฝั่งแสดงผล clamp ที่ 0 เองตอน render
  // (ดู nonNegativeInt ตอนอ่านค่ากลับมาแสดง) ไม่ต้องแก้จุดนี้เพิ่มถ้า UI
  // ที่แสดงสต๊อกอยู่แล้วเรียก nonNegativeInt ก่อนโชว์
  await fsAtomicUpdate(`restockCatalog/${item.id}`, {
    fields: {
      ...normalized,
      latestDeductedBaseQty: baseQtyToDeduct,
      latestDeductedAt: new Date().toISOString(),
    },
    increments: { stock_base_qty: -baseQtyToDeduct },
  });
  return {
    id: item.id,
    previous_stock_base_qty: currentStock,
    ...normalized,
    stock_base_qty: deductBaseQty(currentStock, baseQtyToDeduct),
    latestDeductedBaseQty: baseQtyToDeduct,
  };
}

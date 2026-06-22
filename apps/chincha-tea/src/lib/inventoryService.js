import { fsListCollection, fsPatch, fsPost } from './firestoreRest';
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
  const nextStock = deductBaseQty(currentStock, baseQtyToDeduct);
  const patch = {
    ...normalizeInventoryFields(item),
    stock_base_qty: nextStock,
    latestDeductedBaseQty: baseQtyToDeduct,
    latestDeductedAt: new Date().toISOString(),
  };
  await fsPatch(`restockCatalog/${item.id}`, patch);
  return { id: item.id, previous_stock_base_qty: currentStock, ...patch };
}

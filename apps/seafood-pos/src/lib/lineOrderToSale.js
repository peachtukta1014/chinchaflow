import { PRODUCTS } from '../constants';
import { findCustomerByLineUserId } from '../services/lineOaCustomerService';
import { findCustomersInText } from './voiceParse';

export const LIVE_PRODUCTS = PRODUCTS.filter((p) => p.type === 'live');

/** แมปชื่อสินค้าจาก LINE → id ใน POS */
export function mapLineProductName(product) {
  const p = (product || '').replace(/\s+/g, '');
  if (/ตาย/.test(p)) return 'dead';
  if (/ใหญ่|เกรด\s*เอ|[^ก-๙]a$/i.test(p)) return 'large';
  if (/กลาง|เกรด\s*บี|[^ก-๙]b$/i.test(p)) return 'medium';
  if (/เล็ก|จิ๋ว|เกรด\s*ซี|[^ก-๙]c$/i.test(p)) return 'small';
  return null;
}

function compactName(s) {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

/** จับคู่ชื่อลูกค้าจาก LINE กับรายชื่อในแอป */
export function resolveLineCustomer(customerName, allCustomers, lineUserId) {
  const list = allCustomers || [];
  const general = list.find((c) => c.id === 'general') || {
    id: 'general',
    name: 'ลูกค้าทั่วไปและตลาดนัด',
    zone: 'ทั่วไป',
  };

  const byUid = findCustomerByLineUserId(list, lineUserId);
  if (byUid) return byUid;

  if (!customerName?.trim()) return general;

  const found = findCustomersInText(customerName, list);
  if (found.length) {
    return list.find((c) => c.id === found[0].id) || { id: found[0].id, name: found[0].name, zone: 'ทั่วไป' };
  }

  const cn = compactName(customerName);
  const partial = list.find((c) => {
    const n = compactName(c.name);
    return n.includes(cn) || cn.includes(n);
  });
  if (partial) return partial;

  return { id: 'general', name: customerName.trim(), zone: 'ทั่วไป' };
}

/**
 * แปลงรายการจาก lineOrders → รูปแบบตะกร้า POS
 * @returns {{ cartItems: object[], unknownProducts: string[] }}
 */
export function lineItemsToCartItems(lineItems, priceOf) {
  const cartItems = [];
  const unknownProducts = [];

  for (const item of lineItems || []) {
    const productId = mapLineProductName(item.product);
    if (!productId) {
      unknownProducts.push(item.product || '?');
      continue;
    }
    const prod = PRODUCTS.find((p) => p.id === productId);
    if (!prod) continue;

    const unit = (item.unit || 'กก').replace(/\./g, '');
    const qty = parseFloat(item.qty) || 0;
    if (qty <= 0) continue;

    if (prod.type === 'dead' || unit === 'บาท') {
      const soldByBaht = unit === 'บาท';
      cartItems.push({
        productId: 'dead',
        productName: prod.name,
        type: 'dead',
        weight: soldByBaht ? 0 : qty,
        pricePerKg: 0,
        total: soldByBaht ? qty : 0,
        note: soldByBaht ? `เหมา ${qty} บาท` : '',
        orderedQty: qty,
        orderedUnit: unit,
        lineKey: `line-${cartItems.length}`,
      });
    } else {
      const ppk = priceOf(productId);
      cartItems.push({
        productId,
        productName: prod.name,
        type: 'live',
        weight: qty,
        pricePerKg: ppk,
        total: qty * ppk,
        note: '',
        orderedQty: qty,
        orderedUnit: unit,
        lineKey: `line-${cartItems.length}`,
      });
    }
  }

  return { cartItems, unknownProducts };
}

export function cartStockKg(cartItems) {
  const liveKg = cartItems.reduce((s, i) => (i.type !== 'dead' ? s + i.weight : s), 0);
  const deadKg = cartItems.reduce((s, i) => (i.type === 'dead' ? s + i.weight : s), 0);
  const total = cartItems.reduce((s, i) => s + i.total, 0);
  return { liveKg, deadKg, total };
}

/** ค่าที่ใช้บันทึกจริงต่อบรรทัด (กก. หรือบาทเหมา) */
export function actualQtyOf(item) {
  if (item.type === 'dead' && item.orderedUnit === 'บาท') return item.total;
  return item.weight;
}

export function qtyDiffersFromOrder(item, actual = actualQtyOf(item)) {
  const ordered = parseFloat(item.orderedQty);
  const a = parseFloat(actual);
  if (!Number.isFinite(ordered) || !Number.isFinite(a)) return false;
  return Math.abs(ordered - a) > 0.001;
}

/** ปรับน้ำหนัก/ยอดส่งจริงแล้วคำนวณยอดใหม่ */
export function applyActualToCartItem(item, rawActual, priceOf) {
  const actual = parseFloat(rawActual);
  if (!Number.isFinite(actual) || actual < 0) return item;

  if (item.type === 'dead' && item.orderedUnit === 'บาท') {
    const note = qtyDiffersFromOrder(item, actual)
      ? `เหมา ${actual} บาท (สั่ง ${item.orderedQty} บาท)`
      : `เหมา ${actual} บาท`;
    return { ...item, weight: 0, total: actual, note };
  }

  if (item.type === 'dead') {
    const note = qtyDiffersFromOrder(item, actual) ? `ส่ง ${actual} กก. (สั่ง ${item.orderedQty} กก.)` : '';
    return { ...item, weight: actual, total: 0, note };
  }

  const ppk = item.pricePerKg ?? priceOf(item.productId);
  const note = qtyDiffersFromOrder(item, actual) ? `ส่ง ${actual} กก. (สั่ง ${item.orderedQty} กก.)` : '';
  return { ...item, weight: actual, pricePerKg: ppk, total: actual * ppk, note };
}

export function hasAnyQtyMismatch(cartItems) {
  return cartItems.some((i) => qtyDiffersFromOrder(i));
}

/** เปลี่ยนราคา/กก. แล้วคำนวณยอดใหม่ (live เท่านั้น) */
export function applyPriceToCartItem(item, rawPrice) {
  if (item.type === 'dead') return item;
  const ppk = parseInt(rawPrice, 10);
  if (!Number.isFinite(ppk) || ppk < 0) return item;
  return { ...item, pricePerKg: ppk, total: item.weight * ppk };
}

/** เปลี่ยนไซซ์กุ้ง (large/medium/small) แล้วรีเซ็ตราคาเป็น default ของไซซ์ใหม่ */
export function applySizeToCartItem(item, productId, priceOf) {
  if (item.type === 'dead') return item;
  const prod = PRODUCTS.find((p) => p.id === productId);
  if (!prod || prod.type === 'dead') return item;
  const ppk = priceOf(productId);
  return {
    ...item,
    productId,
    productName: prod.name,
    pricePerKg: ppk,
    total: item.weight * ppk,
  };
}

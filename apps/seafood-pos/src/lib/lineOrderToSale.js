import { PRODUCTS } from '../constants';
import { findCustomersInText } from './voiceParse';

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
export function resolveLineCustomer(customerName, allCustomers) {
  const list = allCustomers || [];
  const general = list.find((c) => c.id === 'general') || {
    id: 'general',
    name: 'ลูกค้าทั่วไปและตลาดนัด',
    zone: 'ทั่วไป',
  };
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

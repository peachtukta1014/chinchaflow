const THAI_NUMBERS = {
  ศูนย์: 0,
  หนึ่ง: 1,
  นึง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
};

const TOPPING_ALIASES = [
  { re: /ไข่มุก|pearl|boba/i, ids: ['pearl'] },
  { re: /บุก(?:บราวน์ชู(?:ก้า|การ์)?)?|brown\s*sugar\s*jelly/i, ids: ['brown-sugar-jelly'] },
  { re: /วุ้น(?:มะพร้าว)?|coco|jelly/i, ids: ['coco-jelly'] },
  { re: /เฉาก๊วย|grass/i, ids: ['grass-jelly'] },
  { re: /บัวลอย|taro\s*ball/i, ids: ['taro-ball'] },
  { re: /ป๊อบ|popping/i, ids: ['popping'] },
];

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return Number(raw);
  return THAI_NUMBERS[raw] ?? fallback;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/([0-9])\s+([0-9])\s*(แก้ว|cup)/g, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTopping(matchText, toppingsList = []) {
  const fromCatalog = toppingsList.find((tp) => {
    const label = String(tp.label || '').trim();
    return label && new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(matchText);
  });
  if (fromCatalog) return fromCatalog;

  for (const alias of TOPPING_ALIASES) {
    if (!alias.re.test(matchText)) continue;
    const found = toppingsList.find((tp) => alias.ids.includes(tp.id));
    if (found) return found;
    if (alias.ids.includes('pearl')) return { id: 'pearl', label: 'ไข่มุก', price: 10, active: true };
    if (alias.ids.includes('brown-sugar-jelly')) return { id: 'brown-sugar-jelly', label: 'บุกบราวน์ชูก้า', price: 10, active: true };
  }
  return null;
}

export function parseSmartPriceOrder(rawText, toppingsList = []) {
  const text = normalize(rawText);
  if (!text) return null;

  const baseMatch = text.match(/(?:^|\s)(\d{1,3})\s*(?:บาท)?\s*(?:x|\*)?\s*(\d+|หนึ่ง|นึง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)?\s*(?:แก้ว|cup|cups)?/i);
  if (!baseMatch) return null;

  const basePrice = toNumber(baseMatch[1]);
  if (basePrice < 1 || basePrice > 999) return null;

  const qty = Math.max(1, toNumber(baseMatch[2], /แก้ว|cup/.test(baseMatch[0]) ? 1 : 1));
  const toppingLines = [];
  const afterBase = text.slice((baseMatch.index || 0) + baseMatch[0].length).trim();
  const toppingChunks = afterBase.split(/(?:,|แล้วก็|และ|\+|เพิ่ม)/).map((s) => s.trim()).filter(Boolean);

  for (const chunk of toppingChunks) {
    const topping = resolveTopping(chunk, toppingsList);
    if (!topping) continue;
    const qtyMatch = chunk.match(/(\d+|หนึ่ง|นึง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*(?:แก้ว|cup)?/i);
    const toppingQty = Math.max(1, Math.min(qty, toNumber(qtyMatch?.[1], 1)));
    toppingLines.push({ ...topping, qty: toppingQty });
  }

  const toppingTotal = toppingLines.reduce((sum, tp) => sum + Number(tp.price || 0) * Number(tp.qty || 1), 0);
  const lineTotal = (basePrice * qty) + toppingTotal;

  return {
    key: 'smart-price-cup',
    emoji: '🥤',
    nameSnapshot: `แก้วละ ${basePrice} บาท`,
    size: 'หน้าร้าน',
    sweet: '-',
    ice: 'normalice',
    toppings: toppingLines,
    price: basePrice,
    qty,
    lineTotal,
    smartPrice: true,
    basePrice,
    note: rawText,
    cartId: Date.now() + Math.random(),
  };
}

export function smartPriceOrderSummary(item) {
  if (!item?.smartPrice) return '';
  const base = `${item.basePrice || item.price}×${item.qty} แก้ว`;
  const toppings = (item.toppings || [])
    .map((tp) => `${tp.label} ${tp.qty || 1} แก้ว +${Number(tp.price || 0) * Number(tp.qty || 1)}`)
    .join(' · ');
  return [base, toppings].filter(Boolean).join(' · ');
}

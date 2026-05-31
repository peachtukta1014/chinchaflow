/**
 * แยกรายการสั่งจากข้อความ LINE
 * ข้อความเข้ามาแปลเป็นไทยก่อน (prepareOrderInput) — เก็บใน Firestore เป็นไทย
 */
const { normalizeQuantityText } = require('./translateOrderText');

const UNIT_ALIASES = {
  'กก': 'กก',
  'กก.': 'กก',
  'ก': 'กก',
  'โล': 'กก',
  'กิโล': 'กก',
  'กิโลกรัม': 'กก',
  'kg': 'กก',
  'บาท': 'บาท',
  '฿': 'บาท',
};

const THAI_NUM = {
  'ศูนย์': 0, 'หนึ่ง': 1, 'เอ็ด': 1, 'สอง': 2, 'ยี่': 2, 'สาม': 3, 'สี่': 4,
  'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9, 'สิบ': 10,
  'ครึ่ง': 0.5,
};

const SHRIMP_PRODUCT_RE = /กุ้ง\s*(ใหญ่|กลาง|เล็ก|ตาย)|กุ้ง(ใหญ่|กลาง|เล็ก|ตาย)/i;
const RIVER_PRAWN_RE = /กุ้ง\s*แม่น้ำ|กุ้งแม่น้ำ/i;
const RIVER_PRAWN_SIZED_RE =
  /กุ้ง\s*แม่น้ำ\s*(ใหญ่|กลาง|เล็ก|ตาย)|กุ้งแม่น้ำ\s*(ใหญ่|กลาง|เล็ก|ตาย)/i;

const RIVER_SIZE_PROMPT =
  '🦐 กุ้งแม่น้ำ — กรุณาเลือกขนาดก่อนยืนยันออเดอร์ครับ\n' +
  '• เล็ก 850 บาท/กก\n' +
  '• กลาง 1,100 บาท/กก\n' +
  '• ใหญ่ 1,450 บาท/กก\n\n' +
  'พิมพ์ เล็ก / กลาง / ใหญ่ ต่อได้ครับ';

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const LINE_RE = new RegExp(
  `([฀-๿A-Za-z][฀-๿A-Za-z0-9\\s]{0,40}?)\\s*([\\d.]+)\\s*(${UNIT_PATTERN})`,
  'gi',
);

const LINE_RE_REV = new RegExp(
  `([\\d.]+)\\s*(${UNIT_PATTERN})\\s+([฀-๿A-Za-z][฀-๿A-Za-z0-9\\s]{0,40})`,
  'gi',
);

function normalizeUnit(raw) {
  const key = (raw || '').replace(/\./g, '').toLowerCase();
  return UNIT_ALIASES[key] || UNIT_ALIASES[raw] || raw;
}

function normalizeOrderText(text) {
  let t = normalizeQuantityText(String(text || '').trim());
  t = t.replace(/ครับ|ค่ะ|คะ|นะ|ด้วย|ลงบันทึก|บันทึกให้|บันทึก|ช่วย|หน่อย|please/gi, ' ');
  Object.entries(THAI_NUM).forEach(([word, n]) => {
    t = t.replace(new RegExp(word, 'gi'), String(n));
  });
  t = t.replace(/(\d)\s*โล/g, '$1 โล');
  t = t.replace(/หนึ่ง\s*โล/gi, '1 โล');
  t = t.replace(/([^\s])(กุ้ง)/gi, '$1 $2');
  return t.replace(/\s+/g, ' ').trim();
}

function pushItem(items, product, qty, unit, customerName) {
  const name = (product || '').trim().replace(/\s+/g, ' ');
  if (!name || !Number.isFinite(qty) || qty <= 0) return;
  items.push({
    product: name,
    qty,
    unit: normalizeUnit(unit),
    customerName: customerName || null,
  });
}

/** กุ้งแม่น้ำ + ขนาด + น้ำหนัก → กุ้งใหญ่/กลาง/เล็ก */
function parseRiverPrawnWithSize(line) {
  const normalized = normalizeOrderText(line);
  if (!RIVER_PRAWN_RE.test(normalized)) return [];

  const sized = normalized.match(RIVER_PRAWN_SIZED_RE);
  if (!sized) return [];

  const sizeWord = (sized[0].match(/(ใหญ่|กลาง|เล็ก|ตาย)/i) || [])[0];
  const product = /ตาย/.test(sizeWord || '') ? 'กุ้งตาย' : `กุ้ง${sizeWord || 'เล็ก'}`;

  const before = normalized.slice(0, sized.index).trim();
  let customerName = null;
  if (before && !/กุ้ง/.test(before)) {
    customerName = before.replace(/^(ถึง|สำหรับ|ลูกค้า)\s*/i, '').trim() || null;
  }

  const unitMatch = normalized.match(new RegExp(`([\\d.,]+)\\s*(${UNIT_PATTERN})`, 'i'));
  if (!unitMatch) return [];

  const items = [];
  pushItem(items, product, parseFloat(unitMatch[1].replace(',', '.')), unitMatch[2], customerName);
  return items;
}

/** กุ้งแม่น้ำโดยไม่ระบุขนาด — รอลูกค้าเลือก เล็ก/กลาง/ใหญ่ */
function parseRiverPrawnPendingLine(line) {
  const normalized = normalizeOrderText(line);
  if (!RIVER_PRAWN_RE.test(normalized)) return null;
  if (RIVER_PRAWN_SIZED_RE.test(normalized)) return null;

  const unitMatch = normalized.match(new RegExp(`([\\d.,]+)\\s*(${UNIT_PATTERN})`, 'i'));
  if (!unitMatch) return null;

  const qty = parseFloat(unitMatch[1].replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const riverIdx = normalized.search(RIVER_PRAWN_RE);
  const before = normalized.slice(0, riverIdx).trim();
  let customerName = null;
  if (before && !/กุ้ง/.test(before) && before.length >= 2) {
    customerName = before.replace(/^(ถึง|สำหรับ|ลูกค้า)\s*/i, '').trim() || null;
  }

  return {
    kind: 'pending_river',
    customerName,
    qty,
    unit: normalizeUnit(unitMatch[2]),
  };
}

function isBareRiverPrawnProduct(product) {
  const p = String(product || '').replace(/\s+/g, '');
  return /กุ้งแม่น้ำ/i.test(p) && !/(ใหญ่|กลาง|เล็ก|ตาย)/i.test(p);
}

function parseShrimpNatural(line) {
  const items = [];
  const normalized = normalizeOrderText(line);
  const productMatch = normalized.match(SHRIMP_PRODUCT_RE);
  if (!productMatch) return items;

  const productRaw = productMatch[0].replace(/\s+/g, '');
  const product = productRaw.includes('ตาย')
    ? 'กุ้งตาย'
    : `กุ้ง${(productRaw.match(/(ใหญ่|กลาง|เล็ก)/i) || [])[0] || 'เล็ก'}`;

  const before = normalized.slice(0, productMatch.index).trim();
  const after = normalized.slice(productMatch.index + productMatch[0].length).trim();

  let customerName = null;
  if (before && !/กุ้ง/.test(before)) {
    customerName = before.replace(/^(ถึง|สำหรับ|ลูกค้า)\s*/i, '').trim() || null;
  }

  const unitMatch = after.match(new RegExp(`([\\d.]+)\\s*(${UNIT_PATTERN})`, 'i'))
    || normalized.match(new RegExp(`([\\d.]+)\\s*(${UNIT_PATTERN})`, 'i'));
  if (!unitMatch) return items;

  const qty = parseFloat(unitMatch[1]);
  const unit = unitMatch[2];
  pushItem(items, product, qty, unit, customerName);
  return items;
}

/** ข้อความยาวในบรรทัดเดียว: ตาจุ้ยกุ้งเล็ก1โล ตาจุ้ยสองกุ้งเล็ก1โล ... */
function parseGluedOrderLine(line) {
  const normalized = normalizeOrderText(line);
  const items = [];
  const segmentRe = /([฀-๿0-9A-Za-z][฀-๿0-9A-Za-z\s]*?)?\s*(กุ้ง\s*(?:ใหญ่|กลาง|เล็ก|ตาย)|กุ้ง(?:ใหญ่|กลาง|เล็ก|ตาย))\s*([\d.]+)\s*(กก\.?|กิโลกรัม|กิโล|โล|kg|บาท|฿)/gi;
  let m;
  while ((m = segmentRe.exec(normalized)) !== null) {
    let customerName = (m[1] || '').trim().replace(/\s+/g, '') || null;
    if (customerName && /^(สั่ง|จอง|order)$/i.test(customerName)) customerName = null;
    const size = (m[2].match(/(ใหญ่|กลาง|เล็ก|ตาย)/i) || [])[0];
    const product = /ตาย/.test(m[2]) ? 'กุ้งตาย' : `กุ้ง${size || 'เล็ก'}`;
    pushItem(items, product, parseFloat(m[3]), m[4], customerName);
  }
  return items;
}

function parseLine(line) {
  const riverSized = parseRiverPrawnWithSize(line);
  if (riverSized.length > 0) return riverSized;

  const glued = parseGluedOrderLine(line);
  if (glued.length > 0) return glued;

  const natural = parseShrimpNatural(line);
  if (natural.length > 0) return natural;

  const items = [];
  let m;
  LINE_RE.lastIndex = 0;
  while ((m = LINE_RE.exec(line)) !== null) {
    const product = (m[1] || '').trim();
    if (/กุ้ง/.test(product) && !isBareRiverPrawnProduct(product)) {
      pushItem(items, product, parseFloat(m[2]), m[3]);
    }
  }
  LINE_RE_REV.lastIndex = 0;
  while ((m = LINE_RE_REV.exec(line)) !== null) {
    const product = (m[3] || '').trim();
    if (/กุ้ง/.test(product) && !isBareRiverPrawnProduct(product)) {
      pushItem(items, product, parseFloat(m[1]), m[2]);
    }
  }
  return items;
}

function parseOrderItems(text) {
  const raw = String(text || '').trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines.length ? lines : [raw]) {
    items.push(...parseLine(line));
  }

  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.customerName}|${it.product}|${it.qty}|${it.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** แยกรายการเป็นคนละออเดอร์ตามชื่อลูกค้า */
function groupItemsByCustomer(items) {
  const groups = new Map();
  for (const it of items) {
    const key = (it.customerName || '').trim() || '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return groups;
}

const SIZE_TO_PRODUCT = {
  ใหญ่: 'กุ้งใหญ่',
  กลาง: 'กุ้งกลาง',
  เล็ก: 'กุ้งเล็ก',
  ตาย: 'กุ้งตาย',
  a: 'กุ้งใหญ่',
  b: 'กุ้งกลาง',
  c: 'กุ้งเล็ก',
  large: 'กุ้งใหญ่',
  medium: 'กุ้งกลาง',
  small: 'กุ้งเล็ก',
  dead: 'กุ้งตาย',
  s: 'กุ้งเล็ก',
  m: 'กุ้งกลาง',
  l: 'กุ้งใหญ่',
};

const DEFAULT_SIMPLE_PRODUCT = 'กุ้งกลาง';

function sizeWordToProduct(word) {
  const w = (word || '').trim().toLowerCase();
  return SIZE_TO_PRODUCT[w] || null;
}

/** ข้อความสั้น: ปุ้ย 2 | จะเขียด6 | ตาจุ้ย กลาง 2 */
function parseSimpleOrderLine(line) {
  const raw = String(line || '').trim();
  if (!raw || /กุ้ง/.test(raw)) return null;

  const sizeOnly = raw.match(/^(ใหญ่|กลาง|เล็ก|ตาย|a|b|c|large|medium|small|s|m|l)$/i);
  if (sizeOnly) {
    return { kind: 'size_only', product: sizeWordToProduct(sizeOnly[1]) };
  }

  let t = normalizeOrderText(raw);
  t = t.replace(/^(ออเดอร์|จอง|สั่ง|order)\s*/i, '').trim();
  if (!t) return null;

  let m = t.match(
    /^([฀-๿A-Za-z0-9][฀-๿A-Za-z0-9\s.'-]{0,28}?)\s+(ใหญ่|กลาง|เล็ก|ตาย|large|medium|small|a|b|c|s|m|l)\s*([\d.,]+)\s*(กก|โล|kg|บาท|฿)?$/i,
  );
  if (m) {
    const product = sizeWordToProduct(m[2]);
    if (!product) return null;
    return {
      kind: 'item',
      customerName: m[1].trim(),
      product,
      qty: parseFloat(String(m[3]).replace(',', '.')),
      unit: m[4] || 'กก',
    };
  }

  m = t.match(/^([฀-๿A-Za-z0-9][฀-๿A-Za-z0-9\s.'-]{0,28}?)\s+([\d.,]+)\s*(กก|โล|kg|บาท|฿)?$/);
  if (m && m[1].trim().length >= 2) {
    return {
      kind: 'pending',
      customerName: m[1].trim(),
      qty: parseFloat(String(m[2]).replace(',', '.')),
      unit: m[3] || 'กก',
    };
  }

  m = t.match(/^([฀-๿]{2,24})([\d.]+)\s*(กก|โล|kg|บาท|฿)?$/);
  if (m) {
    return {
      kind: 'pending',
      customerName: m[1].trim(),
      qty: parseFloat(String(m[2]).replace(',', '.')),
      unit: m[3] || 'กก',
    };
  }

  return null;
}

function simpleToOrderItem(simple) {
  if (!simple || simple.kind !== 'item') return null;
  const items = [];
  pushItem(items, simple.product, simple.qty, simple.unit, simple.customerName);
  return items[0] || null;
}

function pendingToItems(pending, productName) {
  if (!pending?.qty) return [];
  const items = [];
  pushItem(items, productName, pending.qty, pending.unit || 'กก', pending.customerName || null);
  return items;
}

function formatRiverSizePrompt(pending, deliveryDateLabel) {
  const who = pending?.customerName ? `${pending.customerName} · ` : '';
  const qty = pending?.qty;
  const unit = pending?.unit || 'กก';
  const dateLine = deliveryDateLabel ? `\n📅 ส่ง ${deliveryDateLabel}` : '';
  return `📝 ${who}กุ้งแม่น้ำ ${qty} ${unit}${dateLine}\n\n${RIVER_SIZE_PROMPT}`;
}

const ORDER_FORMAT_HELP =
  'รูปแบบสั่งซื้อ (ตัวอย่าง):\n' +
  '• ออเดอร์ 25/5/69 หรือ 25/5/69 → ตั้งวันส่งก่อน\n' +
  '• ปุ้ย 2 หรือ จะเขียด กลาง 6\n' +
  '• กุ้งใหญ่ 2 กก · ตาจุ้ย กุ้งเล็ก 1 โล\n' +
  '• กุ้งแม่น้ำ 4 โล (ระบบจะถามขนาด เล็ก/กลาง/ใหญ่)\n' +
  '• 2 กก กุ้งกลาง\n\n' +
  'หลายลูกค้าในข้อความเดียว → แยกเป็นหลายออเดอร์ในแอป';

module.exports = {
  parseOrderItems,
  parseSimpleOrderLine,
  parseRiverPrawnPendingLine,
  parseRiverPrawnWithSize,
  simpleToOrderItem,
  pendingToItems,
  formatRiverSizePrompt,
  sizeWordToProduct,
  groupItemsByCustomer,
  ORDER_FORMAT_HELP,
  RIVER_SIZE_PROMPT,
  normalizeOrderText,
  DEFAULT_SIMPLE_PRODUCT,
};

/**
 * แยกรายการสั่งจากข้อความ LINE (ภาษาไทย)
 * รองรับ: กุ้งใหญ่ 2 กก | ตาจุ้ย กุ้งเล็ก หนึ่งโล | 2 กก กุ้งกลาง
 */

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
  let t = String(text || '').trim();
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
  const glued = parseGluedOrderLine(line);
  if (glued.length > 0) return glued;

  const natural = parseShrimpNatural(line);
  if (natural.length > 0) return natural;

  const items = [];
  let m;
  LINE_RE.lastIndex = 0;
  while ((m = LINE_RE.exec(line)) !== null) {
    const product = (m[1] || '').trim();
    if (/กุ้ง/.test(product)) {
      pushItem(items, product, parseFloat(m[2]), m[3]);
    }
  }
  LINE_RE_REV.lastIndex = 0;
  while ((m = LINE_RE_REV.exec(line)) !== null) {
    const product = (m[3] || '').trim();
    if (/กุ้ง/.test(product)) {
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

  const sizeOnly = raw.match(/^(ใหญ่|กลาง|เล็ก|ตาย|a|b|c)$/i);
  if (sizeOnly) {
    return { kind: 'size_only', product: sizeWordToProduct(sizeOnly[1]) };
  }

  let t = normalizeOrderText(raw);
  t = t.replace(/^(ออเดอร์|จอง|สั่ง|order)\s*/i, '').trim();
  if (!t) return null;

  let m = t.match(/^([฀-๿][฀-๿\s]{0,24}?)\s+(ใหญ่|กลาง|เล็ก|ตาย)\s*([\d.]+)\s*(กก|โล|kg|บาท|฿)?$/i);
  if (m) {
    const product = sizeWordToProduct(m[2]);
    if (!product) return null;
    return {
      kind: 'item',
      customerName: m[1].trim(),
      product,
      qty: parseFloat(m[3]),
      unit: m[4] || 'กก',
    };
  }

  m = t.match(/^([฀-๿][฀-๿\s]{0,24}?)\s+([\d.]+)\s*(กก|โล|kg|บาท|฿)?$/);
  if (m && m[1].trim().length >= 2) {
    return {
      kind: 'pending',
      customerName: m[1].trim(),
      qty: parseFloat(m[2]),
      unit: m[3] || 'กก',
    };
  }

  m = t.match(/^([฀-๿]{2,24})([\d.]+)\s*(กก|โล|kg|บาท|฿)?$/);
  if (m) {
    return {
      kind: 'pending',
      customerName: m[1].trim(),
      qty: parseFloat(m[2]),
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
  if (!pending?.customerName || !pending.qty) return [];
  const items = [];
  pushItem(items, productName, pending.qty, pending.unit || 'กก', pending.customerName);
  return items;
}

const ORDER_FORMAT_HELP =
  'รูปแบบสั่งซื้อ (ตัวอย่าง):\n' +
  '• ออเดอร์ 25/5/69 หรือ 25/5/69 → ตั้งวันส่งก่อน\n' +
  '• ปุ้ย 2 หรือ จะเขียด กลาง 6\n' +
  '• กุ้งใหญ่ 2 กก · ตาจุ้ย กุ้งเล็ก 1 โล\n' +
  '• 2 กก กุ้งกลาง\n\n' +
  'หลายลูกค้าในข้อความเดียว → แยกเป็นหลายออเดอร์ในแอป';

module.exports = {
  parseOrderItems,
  parseSimpleOrderLine,
  simpleToOrderItem,
  pendingToItems,
  sizeWordToProduct,
  groupItemsByCustomer,
  ORDER_FORMAT_HELP,
  normalizeOrderText,
  DEFAULT_SIMPLE_PRODUCT,
};

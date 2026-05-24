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

function parseLine(line) {
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
    items.push(...parseLine(normalizeOrderText(line)));
  }

  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.customerName}|${it.product}|${it.qty}|${it.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function looksLikeOrderAttempt(text) {
  const t = normalizeOrderText(text);
  return /กุ้ง|กก|โล|กิโล|บาท|฿|\d/.test(t);
}

const ORDER_FORMAT_HELP =
  'รูปแบบสั่งซื้อ (ตัวอย่าง):\n' +
  '• กุ้งใหญ่ 2 กก\n' +
  '• ตาจุ้ย กุ้งเล็ก 1 โล\n' +
  '• 2 กก กุ้งกลาง\n' +
  '• กุ้งตาย 500 บาท\n\n' +
  'ส่งหลายบรรทัดได้ — แสดงในแอปแท็บ "ออเดอร์"';

module.exports = { parseOrderItems, ORDER_FORMAT_HELP, looksLikeOrderAttempt, normalizeOrderText };

/**
 * แยกรายการสั่งจากข้อความ LINE (ภาษาไทย) — ยืดหยุ่นกว่า regex เดิม
 * ตัวอย่างที่รองรับ:
 *   กุ้งใหญ่ 2 กก
 *   2 กก กุ้งกลาง
 *   กุ้งตาย 500 บาท
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

function pushItem(items, product, qty, unit) {
  const name = (product || '').trim().replace(/\s+/g, ' ');
  if (!name || !Number.isFinite(qty) || qty <= 0) return;
  items.push({
    product: name,
    qty,
    unit: normalizeUnit(unit),
  });
}

function parseLine(line) {
  const items = [];
  let m;
  LINE_RE.lastIndex = 0;
  while ((m = LINE_RE.exec(line)) !== null) {
    pushItem(items, m[1], parseFloat(m[2]), m[3]);
  }
  LINE_RE_REV.lastIndex = 0;
  while ((m = LINE_RE_REV.exec(line)) !== null) {
    pushItem(items, m[3], parseFloat(m[1]), m[2]);
  }
  return items;
}

function parseOrderItems(text) {
  const items = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.length ? lines : [text]) {
    items.push(...parseLine(line));
  }

  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.product}|${it.qty}|${it.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const ORDER_FORMAT_HELP =
  'รูปแบบสั่งซื้อ (ตัวอย่าง):\n' +
  '• กุ้งใหญ่ 2 กก\n' +
  '• 2 กก กุ้งกลาง\n' +
  '• กุ้งตาย 500 บาท\n\n' +
  'ส่งหลายบรรทัดได้ครับ — ระบบจะแสดงในแอปแท็บ "ออเดอร์"';

module.exports = { parseOrderItems, ORDER_FORMAT_HELP };

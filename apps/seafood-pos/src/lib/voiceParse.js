/** แปลงข้อความเสียง → ลูกค้า / ขนาดกุ้ง / น้ำหนัก (seafood POS) */

const THAI_DIGIT = {
  ศูนย์: '0', หนึ่ง: '1', สอง: '2', สาม: '3', สี่: '4', ห้า: '5',
  หก: '6', เจ็ด: '7', แปด: '8', เก้า: '9', ครึ่ง: '0.5',
};

const PRODUCT_PATTERNS = [
  { id: 'large', re: /กุ้ง\s*ใหญ่|ไซส์\s*ใหญ่|เกรด\s*เอ|ขนาด\s*เอ|(?:^|[^\wก-๙])เอ(?:[^\wก-๙]|$)|[^ก-๙]a(?:[^ก-๙a-z]|$)|\blarge\b/i },
  { id: 'medium', re: /กุ้ง\s*กลาง|ไซส์\s*กลาง|เกรด\s*บี|ขนาด\s*บี|(?:^|[^\wก-๙])บี(?:[^\wก-๙]|$)|[^ก-๙]b(?:[^ก-๙a-z]|$)|\bmedium\b/i },
  { id: 'small', re: /กุ้ง\s*เล็ก|ไซส์\s*เล็ก|จิ๋ว|เกรด\s*ซี|ขนาด\s*ซี|(?:^|[^\wก-๙])ซี(?:[^\wก-๙]|$)|[^ก-๙]c(?:[^ก-๙a-z]|$)|\bsmall\b/i },
  { id: 'dead', re: /กุ้ง\s*ตาย|ตาย|น็อค|นอก|dead/i },
];

function normalizeText(text) {
  let t = (text || '').toLowerCase().replace(/\s+/g, ' ');
  Object.entries(THAI_DIGIT).forEach(([k, v]) => { t = t.replaceAll(k, v); });
  t = t.replace(/สิบ/g, '10').replace(/ยี่สิบ/g, '20').replace(/ร้อย/g, '100');
  return t;
}

function compact(s) {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

import { collectCustomerSearchNames } from './customerAliases.js';

/** จับคู่ชื่อลูกค้าแบบยืดหยุ่น (รองรับ STT ผิดเล็กน้อย) */
export function findCustomersInText(text, customers) {
  const found = [];
  const tCompact = compact(text);
  for (const c of customers) {
    const names = collectCustomerSearchNames(c);
    for (const rawName of names) {
      const n = normalizeText(rawName);
      const nCompact = compact(n);
      let idx = text.indexOf(rawName);
      if (idx === -1) idx = text.indexOf(n);
      if (idx === -1 && nCompact.length >= 3 && tCompact.includes(nCompact)) {
        idx = tCompact.indexOf(nCompact);
      }
      if (idx !== -1) {
        found.push({ id: c.id, name: c.name, index: idx });
        break;
      }
    }
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set();
  return found.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

export function detectShrimpProduct(segment) {
  for (const { id, re } of PRODUCT_PATTERNS) {
    if (re.test(segment)) return id;
  }
  return null;
}

export function detectShrimpWeight(segment) {
  const mUnit = segment.match(/(\d+(?:\.\d+)?)\s*(?:โล|กก|กิโลกรัม|กิโล|kg)\b/i);
  if (mUnit) return parseFloat(mUnit[1]);

  const mSpace = segment.match(/(\d+(?:\.\d+)?)\s+(?:กิโล|กก)/i);
  if (mSpace) return parseFloat(mSpace[1]);

  const nums = segment.match(/\d+(?:\.\d+)?/g);
  if (nums?.length) {
    const parsed = nums.map((n) => parseFloat(n)).filter((n) => n > 0 && n < 500);
    if (parsed.length) return parsed[parsed.length - 1];
  }
  return null;
}

/**
 * @param {string} text
 * @param {Array<{id:string,name:string}>} customers
 * @param {string} defaultCustomerId — ลูกค้าที่เลือกอยู่ ถ้าไม่พูดชื่อ
 */
export function parseShrimpVoice(text, customers, defaultCustomerId = 'general') {
  const t = normalizeText(text);
  if (!t.trim()) return [];

  const foundCustomers = findCustomersInText(t, customers);
  const segments = [];

  if (foundCustomers.length > 0) {
    for (let i = 0; i < foundCustomers.length; i++) {
      const cur = foundCustomers[i];
      const end = i + 1 < foundCustomers.length ? foundCustomers[i + 1].index : t.length;
      segments.push({ customerId: cur.id, segment: t.substring(cur.index, end) });
    }
  } else {
    segments.push({ customerId: defaultCustomerId, segment: t });
  }

  const orders = [];
  for (const { customerId, segment } of segments) {
    const productId = detectShrimpProduct(segment);
    const weight = detectShrimpWeight(segment);
    if (productId || weight != null) {
      orders.push({
        customerId,
        productId,
        weight: weight != null ? String(weight) : null,
      });
    }
  }
  return orders;
}

export function isVoiceOrderComplete(order) {
  return !!(order?.customerId && order?.productId && order?.weight);
}

export function hasVoiceCommitCommand(text) {
  return /(จบบิล|บันทึก|คอมมิต|คิดเงิน|checkout|confirm|save)/i.test(text || '');
}

import { formatDateThaiShort, shiftDateKey } from './date.js';
import { normalizeLineItem } from './billRowMap.js';

export const TEMPLATE_ROW_NAMES = {
  large: 'กุ้งแม่น้ำ A',
  medium: 'กุ้งแม่น้ำ B',
  small: 'กุ้งแม่น้ำ C',
  dead_large: 'กุ้งแม่น้ำตาย ใหญ่',
  dead_small: 'กุ้งแม่น้ำตาย เล็ก',
};

/** แปลงรายการขาย → ชื่อแถวบนฟอร์มใบส่งของ */
export function resolveTemplateRowName(item) {
  const row = normalizeLineItem(item);
  const productId = item.productId || item.id;

  if (productId === 'large') return TEMPLATE_ROW_NAMES.large;
  if (productId === 'medium') return TEMPLATE_ROW_NAMES.medium;
  if (productId === 'small') return TEMPLATE_ROW_NAMES.small;

  if (productId === 'dead' || row.type === 'dead') {
    const n = `${row.productName} ${row.note}`.toLowerCase();
    if (/เล็ก|small|\bc\b|,c/.test(n)) return TEMPLATE_ROW_NAMES.dead_small;
    if (/ใหญ่|large|\ba\b|,a/.test(n)) return TEMPLATE_ROW_NAMES.dead_large;
    return TEMPLATE_ROW_NAMES.dead_large;
  }

  const name = `${row.productName} ${row.note}`;
  if (/ใหญ่|,?\s*A\b|กุ้งแม่น้ำ\s*A/i.test(name)) return TEMPLATE_ROW_NAMES.large;
  if (/กลาง|,?\s*B\b|กุ้งแม่น้ำ\s*B/i.test(name)) return TEMPLATE_ROW_NAMES.medium;
  if (/เล็ก|,?\s*C\b|กุ้งแม่น้ำ\s*C/i.test(name)) return TEMPLATE_ROW_NAMES.small;
  if (/ตาย.*เล็ก/i.test(name)) return TEMPLATE_ROW_NAMES.dead_small;
  if (/ตาย.*ใหญ่/i.test(name)) return TEMPLATE_ROW_NAMES.dead_large;
  if (/ตาย/i.test(name)) return TEMPLATE_ROW_NAMES.dead_large;

  return null;
}

function mergeBillItem(existing, next) {
  const w1 = parseFloat(existing.quantity) || 0;
  const w2 = parseFloat(next.quantity) || 0;
  const a1 = parseFloat(String(existing.amount).replace(/,/g, '')) || 0;
  const a2 = parseFloat(String(next.amount).replace(/,/g, '')) || 0;
  const totalW = w1 + w2;
  const totalA = a1 + a2;
  return {
    ...existing,
    quantity: totalW > 0 ? String(totalW) : existing.quantity,
    amount: totalA,
    pricePerUnit: totalW > 0 ? Math.round((totalA / totalW) * 100) / 100 : existing.pricePerUnit,
  };
}

function lineToBillItem(raw) {
  const row = normalizeLineItem(raw);
  const templateName = resolveTemplateRowName(raw);
  const isDead = row.type === 'dead';
  return {
    templateName,
    lineLabel: row.productName || '',
    quantity: isDead ? '' : (row.weight > 0 ? String(row.weight) : ''),
    pricePerUnit: isDead ? 0 : (row.pricePerKg > 0 ? row.pricePerKg : 0),
    amount: row.total,
  };
}

/** @returns {import('../components/BillTemplate').BillData} */
export function saleToBillData(bill, customer = {}) {
  const dateKey = bill.dateKey || '';
  const deliveryKey =
    bill.deliveryDateKey ||
    (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? shiftDateKey(dateKey, 1) : '');
  const items = bill.items || [];
  const byTemplate = new Map();
  const extraLines = [];

  for (const raw of items) {
    const line = lineToBillItem(raw);
    if (line.templateName) {
      const entry = {
        name: line.templateName,
        quantity: line.quantity,
        pricePerUnit: line.pricePerUnit,
        amount: line.amount,
      };
      if (byTemplate.has(line.templateName)) {
        byTemplate.set(line.templateName, mergeBillItem(byTemplate.get(line.templateName), entry));
      } else {
        byTemplate.set(line.templateName, entry);
      }
    } else if (line.amount > 0 || line.quantity) {
      extraLines.push({
        name: line.lineLabel || 'อื่นๆ',
        quantity: line.quantity,
        pricePerUnit: line.pricePerUnit,
        amount: line.amount,
      });
    }
  }

  const subtotal =
    parseFloat(bill.total) ||
    items.map(normalizeLineItem).reduce((s, i) => s + i.total, 0);

  const addressParts = [customer.zone || bill.zone, customer.phone || bill.phone].filter(Boolean);

  return {
    bookNo: bill.bookNo || '',
    billNo: bill.billNo || '',
    customerName: bill.customerName || customer.name || '',
    date: formatDateThaiShort(dateKey),
    deliveryDate: formatDateThaiShort(deliveryKey),
    address: addressParts.join(' · '),
    items: Array.from(byTemplate.values()),
    extraLines,
    totalAmount: subtotal,
  };
}

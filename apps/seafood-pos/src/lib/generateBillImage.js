import { BILL_QR_URL, getBillTemplateUrl, MEMBER_DISCOUNT_RATE } from './billTemplateConfig';
import { formatDateThaiShort, shiftDateKey } from './date';

const REF_W = 2683;
const VALUE_COLOR = '#b91c1c';
const FONT = '"Sarabun", "Noto Sans Thai", system-ui, sans-serif';

const LAYOUT = {
  billNo: { x: 0.58, y: 0.276, w: 0.36, h: 0.028, size: 44, weight: '700' },
  date: { x: 0.58, y: 0.300, w: 0.18, h: 0.024, size: 36 },
  time: { x: 0.76, y: 0.300, w: 0.14, h: 0.024, size: 36 },
  customer: { x: 0.16, y: 0.330, w: 0.38, h: 0.028, size: 36, weight: '700' },
  delivery: { x: 0.58, y: 0.330, w: 0.22, h: 0.028, size: 36 },
  address: { x: 0.16, y: 0.354, w: 0.38, h: 0.024, size: 32 },
  phone: { x: 0.58, y: 0.354, w: 0.32, h: 0.024, size: 34 },
  rowStart: 0.403,
  rowHeight: 0.0262,
  tableTop: 0.398,
  tableBottom: 0.858,
  colName: 0.08,
  colNameW: 0.44,
  colQty: 0.53,
  colQtyW: 0.14,
  colPrice: 0.68,
  colPriceW: 0.1,
  colAmount: 0.78,
  colAmountW: 0.12,
  subtotal: { x: 0.72, y: 0.862, w: 0.2, h: 0.024, size: 34 },
  member: { x: 0.72, y: 0.886, w: 0.2, h: 0.024, size: 34 },
  deduct: { x: 0.72, y: 0.910, w: 0.2, h: 0.024, size: 34 },
  net: { x: 0.68, y: 0.936, w: 0.24, h: 0.032, size: 40, weight: '700' },
  qr: { x: 0.048, y: 0.192, size: 0.155 },
};

const MAX_ROWS = 14;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลดรูปไม่ได้: ${src}`));
    img.src = src;
  });
}

function scale(size, canvasW) {
  return Math.round(size * (canvasW / REF_W));
}

/** รองรับทั้ง cart (weight/total) และ Firestore (weightKg/lineTotal) */
export function normalizeLineItem(item) {
  const weight = parseFloat(item.weightKg ?? item.weight ?? 0) || 0;
  const total = parseFloat(item.lineTotal ?? item.total ?? 0) || 0;
  const pricePerKg = parseFloat(item.pricePerKg ?? 0) || 0;
  const type = item.type || (item.productId === 'dead' ? 'dead' : 'live');
  return {
    productName: item.productName || '',
    type,
    weight,
    total,
    pricePerKg,
    note: item.note || '',
  };
}

function fillMask(ctx, W, H, rect) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rect.x * W, rect.y * H, rect.w * W, rect.h * H);
}

function drawTextMasked(ctx, text, W, H, field, opts = {}) {
  const t = String(text ?? '').trim();
  if (!t) return;
  const px = scale(field.size || 32, W);
  const x = field.x * W;
  const y = field.y * H;
  if (field.w && field.h) {
    fillMask(ctx, W, H, field);
  }
  ctx.fillStyle = opts.color || VALUE_COLOR;
  ctx.font = `${opts.weight || field.weight || '600'} ${px}px ${FONT}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'top';
  const tx = opts.align === 'right' ? x + (field.w || 0) * W : x;
  ctx.fillText(t, tx, y + 1);
}

function formatMoney(n) {
  return (parseFloat(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTimeLabel(ts) {
  const m = String(ts || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}.${m[2]}` : '';
}

function itemRowDisplay(item) {
  const row = normalizeLineItem(item);
  if (row.type === 'dead') {
    return {
      name: row.productName,
      qty: '',
      price: '',
      amount: formatMoney(row.total),
    };
  }
  const name = row.note ? `${row.productName} ${row.note}` : row.productName;
  return {
    name,
    qty: row.weight > 0 ? String(row.weight) : '',
    price: row.pricePerKg > 0 ? String(row.pricePerKg) : '',
    amount: formatMoney(row.total),
  };
}

export async function generateBillImage(bill, customer = {}) {
  const templateUrl = getBillTemplateUrl();
  const [bg, qr] = await Promise.all([
    loadImage(templateUrl),
    loadImage(BILL_QR_URL).catch(() => null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas ไม่พร้อม');

  const W = canvas.width;
  const H = canvas.height;
  ctx.drawImage(bg, 0, 0);

  const qSize = LAYOUT.qr.size * W;
  const qx = LAYOUT.qr.x * W;
  const qy = LAYOUT.qr.y * H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qx - 6, qy - 6, qSize + 12, qSize + 12);
  if (qr) ctx.drawImage(qr, qx, qy, qSize, qSize);

  fillMask(ctx, W, H, {
    x: LAYOUT.tableTop,
    y: LAYOUT.tableTop,
    w: 0.9,
    h: LAYOUT.tableBottom - LAYOUT.tableTop,
  });

  const dateKey = bill.dateKey || '';
  const deliveryKey = bill.deliveryDateKey || shiftDateKey(dateKey, 1);
  const items = (bill.items || []).map(normalizeLineItem);
  const subtotal = parseFloat(bill.total) || items.reduce((s, i) => s + i.total, 0);
  const memberOff = subtotal * MEMBER_DISCOUNT_RATE;
  const net = subtotal - memberOff;

  const customerName = bill.customerName || customer.name || '';

  drawTextMasked(ctx, bill.billNo || '', W, H, LAYOUT.billNo);
  drawTextMasked(ctx, formatDateThaiShort(dateKey), W, H, LAYOUT.date);
  drawTextMasked(ctx, formatTimeLabel(bill.timestamp), W, H, LAYOUT.time);
  drawTextMasked(ctx, customerName, W, H, LAYOUT.customer);
  drawTextMasked(ctx, formatDateThaiShort(deliveryKey), W, H, LAYOUT.delivery);
  drawTextMasked(ctx, customer.zone || bill.zone || '', W, H, LAYOUT.address);
  drawTextMasked(ctx, customer.phone || bill.phone || '', W, H, LAYOUT.phone);

  items.slice(0, MAX_ROWS).forEach((item, i) => {
    const row = itemRowDisplay(item);
    const y = LAYOUT.rowStart + i * LAYOUT.rowHeight;
    fillMask(ctx, W, H, { x: LAYOUT.colName, y: y - 0.002, w: 0.86, h: LAYOUT.rowHeight });
    drawTextMasked(ctx, row.name, W, H, {
      x: LAYOUT.colName,
      y,
      w: LAYOUT.colNameW,
      h: LAYOUT.rowHeight,
      size: 30,
    });
    drawTextMasked(ctx, row.qty, W, H, {
      x: LAYOUT.colQty,
      y,
      w: LAYOUT.colQtyW,
      h: LAYOUT.rowHeight,
      size: 30,
    });
    drawTextMasked(ctx, row.price, W, H, {
      x: LAYOUT.colPrice,
      y,
      w: LAYOUT.colPriceW,
      h: LAYOUT.rowHeight,
      size: 30,
    });
    drawTextMasked(ctx, row.amount, W, H, {
      x: LAYOUT.colAmount,
      y,
      w: LAYOUT.colAmountW,
      h: LAYOUT.rowHeight,
      size: 30,
      align: 'right',
    });
  });

  drawTextMasked(ctx, formatMoney(subtotal), W, H, { ...LAYOUT.subtotal, align: 'right' });
  drawTextMasked(ctx, formatMoney(memberOff), W, H, { ...LAYOUT.member, align: 'right' });
  drawTextMasked(ctx, formatMoney(memberOff), W, H, { ...LAYOUT.deduct, align: 'right' });
  drawTextMasked(ctx, formatMoney(net), W, H, { ...LAYOUT.net, align: 'right', weight: '700' });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('สร้างภาพไม่สำเร็จ'))),
      'image/jpeg',
      0.9,
    );
  });

  return { blob, objectUrl: URL.createObjectURL(blob) };
}

export function revokeBillImageUrl(objectUrl) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

export function downloadBillImageBlob(blob, billNo = 'bill') {
  const safe = String(billNo).replace(/[^\w.-]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);
}

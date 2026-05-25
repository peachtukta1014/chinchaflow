import { BILL_QR_URL, getBillTemplateUrl } from './billTemplateConfig';
import { groupBillItemsByRow, isPreprintedProductRow, normalizeLineItem } from './billRowMap';
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
  colName: 0.08,
  colNameW: 0.44,
  colQty: 0.53,
  colQtyW: 0.14,
  colPrice: 0.68,
  colPriceW: 0.1,
  colAmount: 0.78,
  colAmountW: 0.12,
  net: { x: 0.68, y: 0.936, w: 0.24, h: 0.032, size: 40, weight: '700' },
  member: { x: 0.72, y: 0.886, w: 0.2, h: 0.024, size: 34 },
  deduct: { x: 0.72, y: 0.910, w: 0.2, h: 0.024, size: 34 },
  qr: { x: 0.048, y: 0.192, size: 0.155 },
};

const OVERFLOW_ROW_START = 7;
const MAX_OVERFLOW_ROWS = 6;

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

export { normalizeLineItem } from './billRowMap';

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

function itemRowDisplay(item, { includeName = true } = {}) {
  const row = normalizeLineItem(item);
  if (row.type === 'dead') {
    return {
      name: includeName ? row.productName : '',
      qty: '',
      price: '',
      amount: formatMoney(row.total),
    };
  }
  const name = row.note ? `${row.productName} ${row.note}` : row.productName;
  return {
    name: includeName ? name : '',
    qty: row.weight > 0 ? String(row.weight) : '',
    price: row.pricePerKg > 0 ? String(row.pricePerKg) : '',
    amount: formatMoney(row.total),
  };
}

function rowY(rowIndex) {
  return LAYOUT.rowStart + rowIndex * LAYOUT.rowHeight;
}

function drawBillTableRow(ctx, W, H, rowIndex, display, { skipName = false } = {}) {
  const y = rowY(rowIndex);
  const h = LAYOUT.rowHeight;

  if (!skipName && display.name) {
    fillMask(ctx, W, H, { x: LAYOUT.colName, y: y - 0.002, w: LAYOUT.colNameW, h });
    drawTextMasked(ctx, display.name, W, H, {
      x: LAYOUT.colName,
      y,
      w: LAYOUT.colNameW,
      h,
      size: 30,
    });
  }

  if (display.qty) {
    drawTextMasked(ctx, display.qty, W, H, {
      x: LAYOUT.colQty,
      y,
      w: LAYOUT.colQtyW,
      h,
      size: 30,
    });
  }
  if (display.price) {
    drawTextMasked(ctx, display.price, W, H, {
      x: LAYOUT.colPrice,
      y,
      w: LAYOUT.colPriceW,
      h,
      size: 30,
    });
  }
  if (display.amount) {
    drawTextMasked(ctx, display.amount, W, H, {
      x: LAYOUT.colAmount,
      y,
      w: LAYOUT.colAmountW,
      h,
      size: 30,
      align: 'right',
    });
  }
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

  const dateKey = bill.dateKey || '';
  const deliveryKey = bill.deliveryDateKey || shiftDateKey(dateKey, 1);
  const items = bill.items || [];
  const subtotal = parseFloat(bill.total) || items.map(normalizeLineItem).reduce((s, i) => s + i.total, 0);

  const customerName = bill.customerName || customer.name || '';

  drawTextMasked(ctx, bill.billNo || '', W, H, LAYOUT.billNo);
  drawTextMasked(ctx, formatDateThaiShort(dateKey), W, H, LAYOUT.date);
  drawTextMasked(ctx, formatTimeLabel(bill.timestamp), W, H, LAYOUT.time);
  drawTextMasked(ctx, customerName, W, H, LAYOUT.customer);
  drawTextMasked(ctx, formatDateThaiShort(deliveryKey), W, H, LAYOUT.delivery);
  drawTextMasked(ctx, customer.zone || bill.zone || '', W, H, LAYOUT.address);
  drawTextMasked(ctx, customer.phone || bill.phone || '', W, H, LAYOUT.phone);

  const { byRow, overflow } = groupBillItemsByRow(items);

  for (const [rowIndex, item] of byRow.entries()) {
    const skipName = isPreprintedProductRow(rowIndex);
    drawBillTableRow(ctx, W, H, rowIndex, itemRowDisplay(item, { includeName: !skipName }), { skipName });
  }

  overflow.slice(0, MAX_OVERFLOW_ROWS).forEach((item, i) => {
    drawBillTableRow(ctx, W, H, OVERFLOW_ROW_START + i, itemRowDisplay(item, { includeName: true }));
  });

  fillMask(ctx, W, H, LAYOUT.member);
  fillMask(ctx, W, H, LAYOUT.deduct);
  drawTextMasked(ctx, formatMoney(subtotal), W, H, { ...LAYOUT.net, align: 'right', weight: '700' });

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
